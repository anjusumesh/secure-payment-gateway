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
  razorpayOrderId: string;
  amount: number;
  currency: string;
  items: TransactionItem[];
}

export interface FinalizeTransactionPatch {
  status: Extract<TransactionStatus, 'DONE' | 'FAILED' | 'CANCELLED'>;
  razorpayPaymentId?: string;
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

  findByRazorpayOrderId(
    razorpayOrderId: string,
  ): Promise<TransactionDocument | null> {
    return this.transactionModel.findOne({ razorpayOrderId }).exec();
  }

  /**
   * Idempotent finalization: a transaction only ever leaves `INITIATED` once.
   * A retried verify call or a webhook arriving after `/payment/verify` already
   * ran just returns the existing (already-final) document unchanged, so a
   * payment is never double-processed (specs/backend-spec.md Idempotency).
   */
  async finalizeIfInitiated(
    razorpayOrderId: string,
    patch: FinalizeTransactionPatch,
  ): Promise<TransactionDocument | null> {
    const updated = await this.transactionModel
      .findOneAndUpdate(
        { razorpayOrderId, status: 'INITIATED' },
        { $set: patch },
        { returnDocument: 'after' },
      )
      .exec();

    return updated ?? this.findByRazorpayOrderId(razorpayOrderId);
  }
}
