import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_ROLES, Role } from '@okidoc/shared';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { forbidden, unauthorized } from './http';
import { PrismaService } from './prisma.service';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  language: string;
  roles: Role[];
  assignments: { role: Role; clinicId: string | null }[];
  doctorId: string | null;
  deviceRowId: string | null;
}

export interface AccessClaims {
  sub: string;
  did?: string;
  typ: 'access';
}

export const IS_PUBLIC = 'isPublic';
/** Route does not require a logged-in user (an Authorization header is still parsed if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const ROLES_KEY = 'roles';
/** Restrict a route/controller to users holding any of the roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
/** Any Okidoc admin role. ADMIN_SUPER always passes. */
export const AdminOnly = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles.length ? [...roles, 'ADMIN_SUPER'] : ADMIN_ROLES);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

export function signAccessToken(userId: string, deviceRowId?: string | null) {
  const claims: AccessClaims = { sub: userId, did: deviceRowId ?? undefined, typ: 'access' };
  return jwt.sign(claims, config.jwtAccessSecret, { expiresIn: config.accessTtlSeconds });
}

export function verifyAccessToken(token: string): AccessClaims | null {
  try {
    const c = jwt.verify(token, config.jwtAccessSecret) as AccessClaims;
    return c.typ === 'access' ? c : null;
  } catch {
    return null;
  }
}

/** Load the user behind an access token (roles are read fresh so changes apply immediately). */
export async function loadAuthUser(prisma: PrismaService, claims: AccessClaims): Promise<AuthUser | null> {
  const u = await prisma.user.findUnique({
    where: { id: claims.sub },
    include: { roles: true, doctor: { select: { id: true } } },
  });
  if (!u || u.status !== 'ACTIVE') return null;
  if (claims.did) {
    const d = await prisma.device.findUnique({ where: { id: claims.did }, select: { revokedAt: true } });
    if (!d || d.revokedAt) return null;
  }
  return {
    id: u.id,
    phone: u.phone,
    name: u.name,
    language: u.language,
    roles: [...new Set(u.roles.map((r) => r.role as Role))],
    assignments: u.roles.map((r) => ({ role: r.role as Role, clinicId: r.clinicId })),
    doctorId: u.doctor?.id ?? null,
    deviceRowId: claims.did ?? null,
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return true;
    const req = ctx.switchToHttp().getRequest();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (token) {
      const claims = verifyAccessToken(token);
      if (claims) req.user = await loadAuthUser(this.prisma, claims);
      if (!req.user && !isPublic) throw unauthorized('Your session has expired', 'TOKEN_EXPIRED');
    }
    if (isPublic) return true;
    if (!req.user) throw unauthorized();
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.some((r) => (req.user as AuthUser).roles.includes(r))) {
      throw forbidden('Your account role cannot do this');
    }
    return true;
  }
}

export const isAdmin = (u: AuthUser) => u.roles.some((r) => ADMIN_ROLES.includes(r));
