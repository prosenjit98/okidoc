import { Body, Controller, Get, HttpCode, Module, Param, Post, Query } from '@nestjs/common';
import { bookingQuoteSchema, cancelBookingSchema, createBookingSchema, reviewSchema } from '@okidoc/shared';
import { z } from 'zod';
import { AuthUser, CurrentUser, Roles } from '../../common/auth';
import { Zod } from '../../common/http';
import { QueueService } from '../queue/queue.service';
import { BookingsService } from './bookings.service';

@Roles('PATIENT')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly queue: QueueService,
  ) {}

  @HttpCode(200)
  @Post('quote')
  quote(@CurrentUser() u: AuthUser, @Body(new Zod(bookingQuoteSchema)) dto: z.infer<typeof bookingQuoteSchema>) {
    return this.bookings.quote(u.id, dto.sittingId, dto.date);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body(new Zod(createBookingSchema)) dto: z.infer<typeof createBookingSchema>) {
    return this.bookings.create(u.id, dto);
  }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query('scope') scope?: 'upcoming' | 'past' | 'all') {
    return this.bookings.listMine(u.id, scope ?? 'all');
  }

  @Get(':id')
  async get(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const b = await this.bookings.view(id);
    const live = await this.queue.patientLive(id, u.id); // also enforces ownership
    return { ...b, live };
  }

  /** PAT-11 live queue for one booking (also pushed via socket room instance:<id>). */
  @Get(':id/live')
  live(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.queue.patientLive(id, u.id);
  }

  /** BR-06a: tell the clinic "I'm here" (reception confirms). */
  @HttpCode(200)
  @Post(':id/check-in')
  checkIn(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.queue.checkIn(id, u.id);
  }

  /** BR-06a: where a move would land (the doctor's next sitting at this clinic). */
  @Get(':id/next-sitting')
  nextSitting(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.queue.nextSittingPreview(id, u.id);
  }

  /** BR-06a: missed the turn or can't make it: move to the next sitting (once per booking). */
  @HttpCode(200)
  @Post(':id/move-next')
  async moveNext(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    const r = await this.queue.moveToNextSitting(id, u.id, 'PATIENT');
    return { tokenNo: r.booking.tokenNo, date: r.instance.date, startTime: r.instance.startTime, endTime: r.instance.endTime };
  }

  @HttpCode(200)
  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(cancelBookingSchema)) dto: z.infer<typeof cancelBookingSchema>) {
    return this.bookings.cancel(u.id, id, dto.reason);
  }

  @HttpCode(200)
  @Post(':id/review')
  review(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body(new Zod(reviewSchema)) dto: z.infer<typeof reviewSchema>) {
    return this.bookings.review(u.id, id, dto);
  }
}

@Module({ controllers: [BookingsController], providers: [BookingsService], exports: [BookingsService] })
export class BookingsModule {}
