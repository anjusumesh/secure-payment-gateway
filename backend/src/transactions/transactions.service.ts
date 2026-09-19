import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PaymentMethod,
  Transaction,
  TransactionDocument,
  TransactionItem,
  TransactionStatus,
} from './schemas/transaction.schema.js';

export interface CreateTransactionInput {
  paypalOrderId: string;
  amount: number;
  currency: string;
  items: TransactionItem[];
}

export interface FinalizeTransactionPatch {
  status: Extract<TransactionStatus, 'DONE' | 'FAILED' | 'CANCELLED'>;
  paypalCaptureId?: string;
  paymentMethod?: PaymentMethod;
  failureReason?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  create(input: CreateTransactionInput): Promise<TransactionDocument> {
    return this.transactionModel.create({ ...input, status: 'INITIATED' });
  }

  findAll(): Promise<TransactionDocument[]> {
    return this.transactionModel.find().sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<TransactionDocument | null> {
    return this.transactionModel.findById(id).exec();
  }

  findByPaypalOrderId(
    paypalOrderId: string,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({ paypalOrderId }).exec();
  }

  /**
   * Idempotent finalization: a transaction only ever leaves `INITIATED` once.
   * A retried capture call or a webhook arriving after `/payment/capture` already
   * ran just returns the existing (already-final) document unchanged, so a
   * payment is never double-processed (specs/backend-spec.md Idempotency).
   */
  async finalizeIfInitiated(
    paypalOrderId: string,
    patch: FinalizeTransactionPatch,
  ): Promise<TransactionDocument | null> {
    const updated = await this.transactionModel
      .findOneAndUpdate(
        { paypalOrderId, status: 'INITIATED' },
        { $set: patch },
        { returnDocument: 'after' },
      )
      .exec();

    return updated ?? this.findByPaypalOrderId(paypalOrderId);
  }
}
