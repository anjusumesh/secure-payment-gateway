import { NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentService } from './payment.service.js';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

function sign(orderId: string, paymentId: string, secret = KEY_SECRET): string {
  return createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

describe('PaymentService', () => {
  let razorpay: { orders: { create: ReturnType<typeof vi.fn> } };
  let configService: { getOrThrow: ReturnType<typeof vi.fn> };
  let itemsService: { findById: ReturnType<typeof vi.fn> };
  let transactionsService: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    finalizeIfInitiated: ReturnType<typeof vi.fn>;
  };
  let service: PaymentService;

  beforeEach(() => {
    razorpay = { orders: { create: vi.fn() } };
    configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'RAZORPAY_KEY_SECRET') return KEY_SECRET;
        if (key === 'RAZORPAY_WEBHOOK_SECRET') return WEBHOOK_SECRET;
        if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_id';
        throw new Error(`unexpected config key ${key}`);
      }),
    };
    itemsService = { findById: vi.fn() };
    transactionsService = {
      create: vi.fn(),
      findById: vi.fn(),
      finalizeIfInitiated: vi.fn(),
    };

    service = new PaymentService(
      razorpay as never,
      configService as never,
      itemsService as never,
      transactionsService as never,
    );
  });

  describe('createOrder', () => {
    it('computes the total server-side from catalog prices, not the client', async () => {
      itemsService.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'item-1'
            ? { id: 'item-1', name: 'Football', price: 5400 }
            : { id: 'item-2', name: 'Basketball', price: 4900 },
        ),
      );
      razorpay.orders.create.mockResolvedValue({ id: 'order_abc' });
      transactionsService.create.mockResolvedValue({ id: 'txn_1' });

      const result = await service.createOrder({
        items: [
          { itemId: 'item-1', quantity: 2 },
          { itemId: 'item-2', quantity: 1 },
        ],
      });

      const expectedAmount = 5400 * 2 + 4900 * 1;
      expect(razorpay.orders.create).toHaveBeenCalledWith({
        amount: expectedAmount,
        currency: 'INR',
      });
      expect(result.amount).toBe(expectedAmount);
      expect(result.razorpayOrderId).toBe('order_abc');
    });

    it('throws NotFoundException for an unknown item id', async () => {
      itemsService.findById.mockResolvedValue(null);

      await expect(
        service.createOrder({ items: [{ itemId: 'missing', quantity: 1 }] }),
      ).rejects.toThrow(NotFoundException);
      expect(razorpay.orders.create).not.toHaveBeenCalled();
    });
  });

  describe('verify', () => {
    it('finalizes as DONE when the signature is valid', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        razorpayOrderId: 'order_abc',
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'DONE',
      });

      const result = await service.verify({
        transactionId: 'txn_1',
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: sign('order_abc', 'pay_xyz'),
      });

      expect(result.status).toBe('DONE');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'order_abc',
        {
          status: 'DONE',
          razorpayPaymentId: 'pay_xyz',
        },
      );
    });

    it('finalizes as FAILED when the signature does not match — not a thrown error', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        razorpayOrderId: 'order_abc',
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'FAILED',
        failureReason: 'Signature verification failed',
      });

      const result = await service.verify({
        transactionId: 'txn_1',
        razorpayOrderId: 'order_abc',
        razorpayPaymentId: 'pay_xyz',
        razorpaySignature: 'not-the-right-signature',
      });

      expect(result.status).toBe('FAILED');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'order_abc',
        {
          status: 'FAILED',
          failureReason: 'Signature verification failed',
        },
      );
    });

    it('throws NotFoundException when the transaction/order pairing is unknown', async () => {
      transactionsService.findById.mockResolvedValue(null);

      await expect(
        service.verify({
          transactionId: 'missing',
          razorpayOrderId: 'order_abc',
          razorpayPaymentId: 'pay_xyz',
          razorpaySignature: sign('order_abc', 'pay_xyz'),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('finalizes an existing transaction as CANCELLED', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        razorpayOrderId: 'order_abc',
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'CANCELLED',
      });

      const result = await service.cancel({ transactionId: 'txn_1' });

      expect(result.status).toBe('CANCELLED');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'order_abc',
        {
          status: 'CANCELLED',
        },
      );
    });

    it('throws NotFoundException for an unknown transaction id', async () => {
      transactionsService.findById.mockResolvedValue(null);

      await expect(
        service.cancel({ transactionId: 'missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleWebhook', () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { order_id: 'order_abc', id: 'pay_xyz', method: 'upi' },
          },
        },
      }),
    );

    it('rejects a webhook with an invalid signature', async () => {
      await expect(
        service.handleWebhook(rawBody, 'bad-signature'),
      ).rejects.toThrow('Invalid webhook signature');
      expect(transactionsService.finalizeIfInitiated).not.toHaveBeenCalled();
    });

    it('finalizes as DONE for a valid payment.captured webhook', async () => {
      const validSignature = createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      await service.handleWebhook(rawBody, validSignature);

      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'order_abc',
        {
          status: 'DONE',
          razorpayPaymentId: 'pay_xyz',
          paymentMethod: 'upi',
        },
      );
    });
  });
});
