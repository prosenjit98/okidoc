import { Body, Controller, Global, Headers, HttpCode, Module, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { confirmPaymentSchema } from '@okidoc/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { Public } from '../../common/auth';
import { bad, Zod } from '../../common/http';
import { GatewayService } from './gateway';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Called by the app after Razorpay checkout returns (PAY-05). */
  @HttpCode(200)
  @Post('confirm')
  confirm(@Body(new Zod(confirmPaymentSchema)) dto: z.infer<typeof confirmPaymentSchema>) {
    return this.payments.confirm(dto.gatewayOrderId, dto.gatewayPaymentId, dto.signature);
  }

  /** Development checkout simulator (mock gateway only). */
  @HttpCode(200)
  @Post('mock/complete')
  mock(@Body(new Zod(z.object({ gatewayOrderId: z.string(), success: z.boolean().default(true) }))) dto: { gatewayOrderId: string; success: boolean }) {
    return this.payments.simulate(dto.gatewayOrderId, dto.success);
  }

  /** Razorpay webhook (payment.captured, payment.failed, refund.processed). */
  @Public()
  @HttpCode(200)
  @Post('webhook/razorpay')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') sig?: string) {
    if (!req.rawBody || !sig) throw bad('WEBHOOK', 'Missing body or signature');
    return this.payments.handleWebhook(req.rawBody, sig);
  }
}

@Global()
@Module({ controllers: [PaymentsController], providers: [PaymentsService, GatewayService], exports: [PaymentsService, GatewayService] })
export class PaymentsModule {}
