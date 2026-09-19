import type { RawBodyRequest } from '@nestjs/common';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CancelPaymentDto } from './dto/cancel-payment.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { PaymentService } from './payment.service.js';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentService.createOrder(dto);
  }

  @Post('verify')
  @HttpCode(200)
  verify(@Body() dto: VerifyPaymentDto) {
    return this.paymentService.verify(dto);
  }

  @Post('cancel')
  @HttpCode(200)
  cancel(@Body() dto: CancelPaymentDto) {
    return this.paymentService.cancel(dto);
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers['x-razorpay-signature'];
    await this.paymentService.handleWebhook(
      request.rawBody ?? Buffer.from(''),
      typeof signature === 'string' ? signature : undefined,
    );
    return { received: true };
  }
}
