import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { CancelPaymentDto } from './dto/cancel-payment.dto.js';
import { CapturePaymentDto } from './dto/capture-payment.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { PaymentService } from './payment.service.js';
import type { PaypalWebhookEvent } from './paypal.types.js';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentService.createOrder(dto);
  }

  @Post('capture')
  @HttpCode(200)
  capture(@Body() dto: CapturePaymentDto) {
    return this.paymentService.capture(dto);
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(@Body() dto: CancelPaymentDto) {
    return this.paymentService.cancel(dto);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() event: PaypalWebhookEvent,
  ) {
    await this.paymentService.handleWebhook(headers, event);
    return { received: true };
  }
}
