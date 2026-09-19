import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaypalApiError } from './paypal-client.service.js';
import { PaymentService } from './payment.service.js';

describe('PaymentService', () => {
  let paypal: { request: ReturnType<typeof vi.fn> };
  let configService: { getOrThrow: ReturnType<typeof vi.fn> };
  let itemsService: { findById: ReturnType<typeof vi.fn> };
  let transactionsService: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    finalizeIfInitiated: ReturnType<typeof vi.fn>;
  };
  let service: PaymentService;

  beforeEach(() => {
    paypal = { request: vi.fn() };
    configService = {
      getOrThrow: vi.fn((key: string) => {
        if (key === 'PAYPAL_CLIENT_ID') return 'sb-client-id';
        if (key === 'PAYPAL_WEBHOOK_ID') return 'WH-123';
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
      paypal as never,
      configService as never,
      itemsService as never,
      transactionsService as never,
    );
  });

  describe('createOrder', () => {
    it('computes the total server-side from catalog prices and converts to a decimal string', async () => {
      itemsService.findById.mockImplementation((id: string) =>
        Promise.resolve(
          id === 'item-1'
            ? { id: 'item-1', name: 'Football', price: 5400 }
            : { id: 'item-2', name: 'Basketball', price: 4900 },
        ),
      );
      paypal.request.mockResolvedValue({ id: 'ORDER123' });
      transactionsService.create.mockResolvedValue({ id: 'txn_1' });

      const result = await service.createOrder({
        items: [
          { itemId: 'item-1', quantity: 2 },
          { itemId: 'item-2', quantity: 1 },
        ],
      });

      const expectedAmount = 5400 * 2 + 4900 * 1; // 15700 cents
      expect(paypal.request).toHaveBeenCalledWith(
        '/v2/checkout/orders',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
              { amount: { currency_code: 'USD', value: '157.00' } },
            ],
          }),
        }),
      );
      expect(result.amount).toBe(expectedAmount);
      expect(result.paypalOrderId).toBe('ORDER123');
      expect(result.clientId).toBe('sb-client-id');
    });

    it('throws NotFoundException for an unknown item id', async () => {
      itemsService.findById.mockResolvedValue(null);

      await expect(
        service.createOrder({ items: [{ itemId: 'missing', quantity: 1 }] }),
      ).rejects.toThrow(NotFoundException);
      expect(paypal.request).not.toHaveBeenCalled();
    });
  });

  describe('capture', () => {
    it('finalizes as DONE when PayPal reports a completed capture', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        paypalOrderId: 'ORDER123',
      });
      paypal.request.mockResolvedValue({
        status: 'COMPLETED',
        purchase_units: [
          { payments: { captures: [{ id: 'CAPTURE1', status: 'COMPLETED' }] } },
        ],
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'DONE',
      });

      const result = await service.capture({
        transactionId: 'txn_1',
        paypalOrderId: 'ORDER123',
      });

      expect(result.status).toBe('DONE');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'ORDER123',
        {
          status: 'DONE',
          paypalCaptureId: 'CAPTURE1',
          paymentMethod: 'paypal',
        },
      );
    });

    it('finalizes as FAILED when PayPal reports a non-completed status — not a thrown error', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        paypalOrderId: 'ORDER123',
      });
      paypal.request.mockResolvedValue({
        status: 'DECLINED',
        purchase_units: [
          { payments: { captures: [{ id: 'CAPTURE1', status: 'DECLINED' }] } },
        ],
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'FAILED',
        failureReason: 'DECLINED',
      });

      const result = await service.capture({
        transactionId: 'txn_1',
        paypalOrderId: 'ORDER123',
      });

      expect(result.status).toBe('FAILED');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'ORDER123',
        {
          status: 'FAILED',
          failureReason: 'DECLINED',
        },
      );
    });

    it('finalizes as FAILED when PayPal returns an API error (e.g. instrument declined)', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        paypalOrderId: 'ORDER123',
      });
      paypal.request.mockRejectedValue(
        new PaypalApiError(422, {
          details: [{ issue: 'INSTRUMENT_DECLINED' }],
        }),
      );
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'FAILED',
        failureReason: 'INSTRUMENT_DECLINED',
      });

      const result = await service.capture({
        transactionId: 'txn_1',
        paypalOrderId: 'ORDER123',
      });

      expect(result.status).toBe('FAILED');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'ORDER123',
        {
          status: 'FAILED',
          failureReason: 'INSTRUMENT_DECLINED',
        },
      );
    });

    it('throws NotFoundException when the transaction/order pairing is unknown', async () => {
      transactionsService.findById.mockResolvedValue(null);

      await expect(
        service.capture({
          transactionId: 'missing',
          paypalOrderId: 'ORDER123',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(paypal.request).not.toHaveBeenCalled();
    });

    it('propagates a non-422 PayPal error instead of recording it as a customer decline', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        paypalOrderId: 'ORDER123',
      });
      paypal.request.mockRejectedValue(new PaypalApiError(401, { message: 'Auth failed' }));

      await expect(
        service.capture({ transactionId: 'txn_1', paypalOrderId: 'ORDER123' }),
      ).rejects.toThrow(PaypalApiError);
      // A 401 means our own credentials/integration are broken, not that the
      // customer's payment was declined — the transaction must stay INITIATED.
      expect(transactionsService.finalizeIfInitiated).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('finalizes an existing transaction as CANCELLED', async () => {
      transactionsService.findById.mockResolvedValue({
        id: 'txn_1',
        paypalOrderId: 'ORDER123',
      });
      transactionsService.finalizeIfInitiated.mockResolvedValue({
        status: 'CANCELLED',
      });

      const result = await service.cancel({ transactionId: 'txn_1' });

      expect(result.status).toBe('CANCELLED');
      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'ORDER123',
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
    const event = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAPTURE1',
        supplementary_data: { related_ids: { order_id: 'ORDER123' } },
      },
    };

    it('rejects a webhook PayPal cannot verify', async () => {
      paypal.request.mockResolvedValue({ verification_status: 'FAILURE' });

      await expect(service.handleWebhook({}, event)).rejects.toThrow(
        BadRequestException,
      );
      expect(transactionsService.finalizeIfInitiated).not.toHaveBeenCalled();
    });

    it('finalizes as DONE for a verified payment.capture.completed webhook', async () => {
      paypal.request.mockResolvedValue({ verification_status: 'SUCCESS' });

      await service.handleWebhook({}, event);

      expect(transactionsService.finalizeIfInitiated).toHaveBeenCalledWith(
        'ORDER123',
        {
          status: 'DONE',
          paypalCaptureId: 'CAPTURE1',
          paymentMethod: 'paypal',
        },
      );
    });
  });
});
