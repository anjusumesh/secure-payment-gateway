import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type Razorpay from 'razorpay';
import { ItemsService } from '../items/items.service.js';
import {
  PaymentMethod,
  PAYMENT_METHODS,
  TransactionItem,
} from '../transactions/schemas/transaction.schema.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { CancelPaymentDto } from './dto/cancel-payment.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { VerifyPaymentDto } from './dto/verify-payment.dto.js';
import { RAZORPAY_CLIENT } from './razorpay.provider.js';

export interface CreateOrderResult {
  transactionId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        order_id: string;
        id: string;
        method?: string;
        error_description?: string;
      };
    };
  };
}

const CURRENCY = 'INR';

function isPaymentMethod(value: string | undefined): value is PaymentMethod {
  return !!value && (PAYMENT_METHODS as readonly string[]).includes(value);
}

@Injectable()
export class PaymentService {
  constructor(
    @Inject(RAZORPAY_CLIENT) private readonly razorpay: Razorpay,
    private readonly configService: ConfigService,
    private readonly itemsService: ItemsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  /**
   * Recomputes the total server-side from the catalog — a client-supplied
   * price/total is never trusted (specs/frontend-spec.md UX/Security).
   */
  async createOrder(dto: CreateOrderDto): Promise<CreateOrderResult> {
    const lineItems: TransactionItem[] = [];
    let amount = 0;

    for (const cartItem of dto.items) {
      const item = await this.itemsService.findById(cartItem.itemId);
      if (!item) {
        throw new NotFoundException(`Item ${cartItem.itemId} not found`);
      }
      amount += item.price * cartItem.quantity;
      lineItems.push({
        itemId: item.id as string,
        name: item.name,
        unitPrice: item.price,
        quantity: cartItem.quantity,
      });
    }

    const razorpayOrder = await this.razorpay.orders.create({
      amount,
      currency: CURRENCY,
    });

    const transaction = await this.transactionsService.create({
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: CURRENCY,
      items: lineItems,
    });

    return {
      transactionId: transaction.id as string,
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: CURRENCY,
      keyId: this.configService.getOrThrow<string>('RAZORPAY_KEY_ID'),
    };
  }

  /**
   * A signature mismatch or gateway-reported decline is a normal business
   * outcome, not a client error — callers return this as a 200
   * (specs/api-contract.md POST /payment/verify).
   */
  async verify(
    dto: VerifyPaymentDto,
  ): Promise<{ status: string; reason?: string }> {
    const transaction = await this.transactionsService.findById(
      dto.transactionId,
    );
    if (!transaction || transaction.razorpayOrderId !== dto.razorpayOrderId) {
      throw new NotFoundException('Transaction not found');
    }

    const isValid = this.verifySignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );

    const updated = isValid
      ? await this.transactionsService.finalizeIfInitiated(
          dto.razorpayOrderId,
          {
            status: 'DONE',
            razorpayPaymentId: dto.razorpayPaymentId,
          },
        )
      : await this.transactionsService.finalizeIfInitiated(
          dto.razorpayOrderId,
          {
            status: 'FAILED',
            failureReason: 'Signature verification failed',
          },
        );

    return {
      status: updated?.status ?? 'FAILED',
      reason: updated?.failureReason ?? undefined,
    };
  }

  async cancel(dto: CancelPaymentDto): Promise<{ status: string }> {
    const transaction = await this.transactionsService.findById(
      dto.transactionId,
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updated = await this.transactionsService.finalizeIfInitiated(
      transaction.razorpayOrderId,
      { status: 'CANCELLED' },
    );

    return { status: updated?.status ?? 'CANCELLED' };
  }

  /**
   * Authoritative fallback confirmation, applying the same idempotent update
   * as verify() — see specs/backend-spec.md Architecture step 6.
   */
  async handleWebhook(
    rawBody: Buffer,
    signature: string | undefined,
  ): Promise<void> {
    const webhookSecret = this.configService.getOrThrow<string>(
      'RAZORPAY_WEBHOOK_SECRET',
    );
    if (
      !signature ||
      !this.verifyWebhookSignature(rawBody, signature, webhookSecret)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(
      rawBody.toString('utf8'),
    ) as RazorpayWebhookPayload;
    const paymentEntity = payload.payload.payment.entity;

    if (payload.event === 'payment.captured') {
      await this.transactionsService.finalizeIfInitiated(
        paymentEntity.order_id,
        {
          status: 'DONE',
          razorpayPaymentId: paymentEntity.id,
          ...(isPaymentMethod(paymentEntity.method)
            ? { paymentMethod: paymentEntity.method }
            : {}),
        },
      );
    } else if (payload.event === 'payment.failed') {
      await this.transactionsService.finalizeIfInitiated(
        paymentEntity.order_id,
        {
          status: 'FAILED',
          failureReason: paymentEntity.error_description ?? 'Payment failed',
        },
      );
    }
  }

  private verifySignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const keySecret = this.configService.getOrThrow<string>(
      'RAZORPAY_KEY_SECRET',
    );
    const expected = createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return this.safeCompare(expected, signature);
  }

  private verifyWebhookSignature(
    rawBody: Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return this.safeCompare(expected, signature);
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(actual, 'utf8');
    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
