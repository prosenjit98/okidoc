import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { ticketReplySchema, ticketSchema } from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser } from '../../common/auth';
import { bad, forbidden, must, Zod } from '../../common/http';
import { PrismaService } from '../../common/prisma.service';

/** CLN-21 / PAT-18 Contact & support, including block appeals (BR-07c). */
@Controller('support')
export class SupportController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('contact')
  contact() {
    return {
      email: 'support@okidoc.in',
      phone: '+91 33 0000 0000',
      hours: 'Mon–Sat, 9 AM – 8 PM IST',
      grievanceOfficer: { name: 'Grievance Officer, Okidoc', email: 'grievance@okidoc.in' },
    };
  }

  @Get('tickets')
  mine(@CurrentUser() u: AuthUser) {
    return this.prisma.supportTicket.findMany({ where: { userId: u.id }, orderBy: { updatedAt: 'desc' }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  }

  @Post('tickets')
  async create(@CurrentUser() u: AuthUser, @Body(new Zod(ticketSchema)) dto: z.infer<typeof ticketSchema>) {
    const open = await this.prisma.supportTicket.count({ where: { userId: u.id, status: { in: ['OPEN', 'PENDING'] } } });
    if (open >= 5) throw bad('TOO_MANY_TICKETS', 'You already have 5 open requests. We will reply soon.');
    return this.prisma.supportTicket.create({
      data: {
        userId: u.id,
        subject: dto.subject,
        category: dto.category,
        clinicId: dto.clinicId,
        bookingId: dto.bookingId,
        messages: { create: { authorId: u.id, body: dto.body } },
      },
      include: { messages: true },
    });
  }

  @Post('tickets/:id/reply')
  async reply(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(ticketReplySchema)) dto: z.infer<typeof ticketReplySchema>) {
    const t = must(await this.prisma.supportTicket.findUnique({ where: { id } }), 'Ticket');
    if (t.userId !== u.id) throw forbidden();
    await this.prisma.ticketMessage.create({ data: { ticketId: id, authorId: u.id, body: dto.body } });
    return this.prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN' }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
  }
}

@Module({ controllers: [SupportController] })
export class SupportModule {}
