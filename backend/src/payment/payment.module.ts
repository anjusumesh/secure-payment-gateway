import { Module } from '@nestjs/common';
import { ItemsModule } from '../items/items.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { PaymentController } from './payment.controller.js';
import { PaymentService } from './payment.service.js';
import { PaypalClientService } from './paypal-client.service.js';

@Module({
  imports: [ItemsModule, TransactionsModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaypalClientService],
})
export class PaymentModule {}
