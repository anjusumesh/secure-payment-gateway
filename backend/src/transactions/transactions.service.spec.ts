import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionsService } from './transactions.service.js';

describe('TransactionsService', () => {
  let model: {
    findOneAndUpdate: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
  };
  let service: TransactionsService;

  beforeEach(() => {
    model = { findOneAndUpdate: vi.fn(), findOne: vi.fn() };
    service = new TransactionsService(model as never);
  });

  describe('finalizeIfInitiated', () => {
    it('updates the transaction when it is still INITIATED', async () => {
      const updatedDoc = { razorpayOrderId: 'order_abc', status: 'DONE' };
      model.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(updatedDoc),
      });

      const result = await service.finalizeIfInitiated('order_abc', {
        status: 'DONE',
        razorpayPaymentId: 'pay_xyz',
      });

      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        { razorpayOrderId: 'order_abc', status: 'INITIATED' },
        { $set: { status: 'DONE', razorpayPaymentId: 'pay_xyz' } },
        { returnDocument: 'after' },
      );
      expect(result).toBe(updatedDoc);
      // A terminal transaction is never re-read once the atomic update succeeds.
      expect(model.findOne).not.toHaveBeenCalled();
    });

    it('is a no-op that returns the existing document when already terminal', async () => {
      // The findOneAndUpdate filter (status: INITIATED) matches nothing once the
      // transaction is already DONE/FAILED/CANCELLED — so it returns null here,
      // and finalizeIfInitiated falls back to reading the current (unchanged) state.
      model.findOneAndUpdate.mockReturnValue({
        exec: () => Promise.resolve(null),
      });
      const existingDoc = { razorpayOrderId: 'order_abc', status: 'DONE' };
      model.findOne.mockReturnValue({
        exec: () => Promise.resolve(existingDoc),
      });

      const result = await service.finalizeIfInitiated('order_abc', {
        status: 'FAILED',
        failureReason: 'stray retry',
      });

      expect(result).toBe(existingDoc);
      expect(result?.status).toBe('DONE'); // not overwritten to FAILED
    });
  });
});
