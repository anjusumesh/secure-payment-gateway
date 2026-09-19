import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ItemsService } from '../items/items.service.js';
import { TransactionItem } from '../transactions/schemas/transaction.schema.js';
import { TransactionsService } from '../transactions/transactions.service.js';
import { CancelPaymentDto } from './dto/cancel-payment.dto.js';
import { CapturePaymentDto } from './dto/capture-payment.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import {
  PaypalApiError,
  PaypalClientService,
} from './paypal-client.service.js';
import type {
  PaypalCaptureOrderResponse,
  PaypalOrder,
  PaypalWebhookEvent,
  PaypalWebhookVerifyResponse,
} from './paypal.types.js';

export interface CreateOrderResult {
  transactionId: string;
  paypalOrderId: string;
  amount: number;
  currency: string;
  clientId: string;
}

const CURRENCY = 'USD';

function toDecimalAmount(minorUnits: number): string {
  return (minorUnits / 100).toFixed(2);
}

function extractPaypalIssue(body: unknown): string {
  if (body && typeof body === 'object') {
    const details = (body as { details?: Array<{ issue?: string }> }).details;
    if (details?.[0]?.issue) return details[0].issue;
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Capture failed';
}

@Injectable()
export class PaymentService {
  constructor(
    private readonly paypal: PaypalClientService,
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

    const paypalOrder = await this.paypal.request<PaypalOrder>(
      '/v2/checkout/orders',
      {
        method: 'POST',
        headers: { 'PayPal-Request-Id': randomUUID() },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: CURRENCY,
                value: toDecimalAmount(amount),
              },
            },
          ],
        }),
      },
    );

    const transaction = await this.transactionsService.create({
      paypalOrderId: paypalOrder.id,
      amount,
      currency: CURRENCY,
      items: lineItems,
    });

    return {
      transactionId: transaction.id as string,
      paypalOrderId: paypalOrder.id,
      amount,
      currency: CURRENCY,
      clientId: this.configService.getOrThrow<string>('PAYPAL_CLIENT_ID'),
    };
  }

  /**
   * There is no client-supplied proof to check here (unlike a signature
   * scheme) — the backend calls PayPal's own capture endpoint and trusts
   * that response directly. A decline is a normal business outcome, not a
   * client error (specs/api-contract.md POST /payment/capture).
   */
  async capture(
    dto: CapturePaymentDto,
  ): Promise<{ status: string; reason?: string }> {
    const transaction = await this.transactionsService.findById(
      dto.transactionId,
    );
    if (!transaction || transaction.paypalOrderId !== dto.paypalOrderId) {
      throw new NotFoundException('Transaction not found');
    }

    try {
      const result = await this.paypal.request<PaypalCaptureOrderResponse>(
        `/v2/checkout/orders/${dto.paypalOrderId}/capture`,
        { method: 'POST', body: JSON.stringify({}) },
      );

      const capture = result.purchase_units[0]?.payments?.captures?.[0];
      const isCompleted =
        result.status === 'COMPLETED' && capture?.status === 'COMPLETED';

      const updated = isCompleted
        ? await this.transactionsService.finalizeIfInitiated(
            dto.paypalOrderId,
            {
              status: 'DONE',
              paypalCaptureId: capture?.id,
              paymentMethod: 'paypal',
            },
          )
        : await this.transactionsService.finalizeIfInitiated(
            dto.paypalOrderId,
            {
              status: 'FAILED',
              failureReason: capture?.status ?? result.status,
            },
          );

      return {
        status: updated?.status ?? 'FAILED',
        reason: updated?.failureReason ?? undefined,
      };
    } catch (err) {
      // Only a 422 UNPROCESSABLE_ENTITY is PayPal's documented shape for a
      // declined payment (a normal business outcome). Anything else — a 401
      // from misconfigured credentials, a 5xx, a network failure — means our
      // own integration is broken, not that the customer's payment failed,
      // so it must NOT be recorded as a customer-facing FAILED transaction;
      // let it propagate to the global exception filter as a genuine 500.
      if (err instanceof PaypalApiError && err.status === 422) {
        const updated = await this.transactionsService.finalizeIfInitiated(
          dto.paypalOrderId,
          { status: 'FAILED', failureReason: extractPaypalIssue(err.body) },
        );
        return {
          status: updated?.status ?? 'FAILED',
          reason: updated?.failureReason ?? undefined,
        };
      }
      throw err;
    }
  }

  async cancel(dto: CancelPaymentDto): Promise<{ status: string }> {
    const transaction = await this.transactionsService.findById(
      dto.transactionId,
    );
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const updated = await this.transactionsService.finalizeIfInitiated(
      transaction.paypalOrderId,
      {
        status: 'CANCELLED',
      },
    );

    return { status: updated?.status ?? 'CANCELLED' };
  }

  /**
   * Authoritative fallback confirmation. PayPal verifies its own signature
   * server-to-server — we call verify-webhook-signature rather than
   * computing an HMAC locally (specs/backend-spec.md Architecture step 6).
   */
  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    event: PaypalWebhookEvent,
  ): Promise<void> {
    const webhookId =
      this.configService.getOrThrow<string>('PAYPAL_WEBHOOK_ID');

    const verification = await this.paypal.request<PaypalWebhookVerifyResponse>(
      '/v1/notifications/verify-webhook-signature',
      {
        method: 'POST',
        body: JSON.stringify({
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: webhookId,
          webhook_event: event,
        }),
      },
    );

    if (verification.verification_status !== 'SUCCESS') {
      throw new BadRequestException('Invalid webhook signature');
    }

    const orderId = event.resource.supplementary_data?.related_ids?.order_id;
    if (!orderId) return;

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      await this.transactionsService.finalizeIfInitiated(orderId, {
        status: 'DONE',
        paypalCaptureId: event.resource.id,
        paymentMethod: 'paypal',
      });
    } else if (event.event_type === 'PAYMENT.CAPTURE.DENIED') {
      await this.transactionsService.finalizeIfInitiated(orderId, {
        status: 'FAILED',
        failureReason:
          event.resource.status_details?.reason ?? 'Payment denied',
      });
    }
  }
}
