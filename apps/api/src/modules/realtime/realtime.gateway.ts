import { Global, Injectable, Logger, Module } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { isAdmin, loadAuthUser, verifyAccessToken, AuthUser } from '../../common/auth';
import { PrismaService } from '../../common/prisma.service';
import { config } from '../../config';

/**
 * Live queue fan-out (NFR-01). Rooms:
 *   instance:<id>  — public, anyone following a sitting's queue
 *   clinic:<id>    — clinic staff (owner / queue manager) and admins
 *   user:<id>      — the logged-in user's own notifications
 * For multi-node deployments add the socket.io Redis adapter (REDIS_URL).
 */
@WebSocketGateway({ cors: { origin: config.corsOrigins, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly log = new Logger('Realtime');

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(client: Socket) {
    const token = (client.handshake.auth?.token as string | undefined) ?? undefined;
    if (token) {
      const claims = verifyAccessToken(token);
      const user = claims ? await loadAuthUser(this.prisma, claims) : null;
      if (user) {
        client.data.user = user;
        client.join(`user:${user.id}`);
      }
    }
  }

  @SubscribeMessage('subscribe')
  async subscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { room?: string }) {
    const room = body?.room ?? '';
    const [kind, id] = room.split(':');
    if (!id) return { ok: false, error: 'Bad room' };
    if (kind === 'instance') {
      client.join(room);
      return { ok: true };
    }
    if (kind === 'clinic') {
      const user = client.data.user as AuthUser | undefined;
      if (!user) return { ok: false, error: 'Login required' };
      const allowed = isAdmin(user) || user.assignments.some((a) => a.clinicId === id);
      if (!allowed) {
        // Doctors linked to the clinic may watch too
        const link = user.doctorId
          ? await this.prisma.clinicDoctorLink.findFirst({ where: { clinicId: id, doctorId: user.doctorId, status: 'APPROVED' } })
          : null;
        if (!link) return { ok: false, error: 'Forbidden' };
      }
      client.join(room);
      return { ok: true };
    }
    return { ok: false, error: 'Unknown room' };
  }

  @SubscribeMessage('unsubscribe')
  unsubscribe(@ConnectedSocket() client: Socket, @MessageBody() body: { room?: string }) {
    if (body?.room) client.leave(body.room);
    return { ok: true };
  }
}

@Injectable()
export class RealtimeService {
  constructor(private readonly gateway: RealtimeGateway) {}
  private get io() {
    return this.gateway.server;
  }
  emitInstance(instanceId: string, event: string, payload: unknown) {
    this.io?.to(`instance:${instanceId}`).emit(event, payload);
  }
  emitClinic(clinicId: string, event: string, payload: unknown) {
    this.io?.to(`clinic:${clinicId}`).emit(event, payload);
  }
  emitUser(userId: string, event: string, payload: unknown) {
    this.io?.to(`user:${userId}`).emit(event, payload);
  }
}

@Global()
@Module({ providers: [RealtimeGateway, RealtimeService], exports: [RealtimeService] })
export class RealtimeModule {}
