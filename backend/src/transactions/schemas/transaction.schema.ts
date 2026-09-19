import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { toIdJson } from '../../common/mongoose/to-json-transform.js';

export type TransactionDocument = HydratedDocument<Transaction>;

export const TRANSACTION_STATUSES = [
  'INITIATED',
  'DONE',
  'FAILED',
  'CANCELLED',
] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const PAYMENT_METHODS = ['paypal'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

@Schema({ _id: false })
export class TransactionItem {
  @Prop({ type: String, required: true })
  itemId: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true })
  unitPrice: number;

  @Prop({ type: Number, required: true })
  quantity: number;
}

export const TransactionItemSchema =
  SchemaFactory.createForClass(TransactionItem);

@Schema({ timestamps: true, toJSON: { transform: toIdJson } })
export class Transaction {
  @Prop({ type: String, required: true, unique: true })
  paypalOrderId: string;

  @Prop({ type: String, default: null })
  paypalCaptureId: string | null;

  @Prop({
    type: String,
    enum: TRANSACTION_STATUSES,
    required: true,
    default: 'INITIATED',
  })
  status: TransactionStatus;

  /** Server-computed total, in minor currency units (e.g. cents) — never trusted from the client. */
  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, required: true, default: 'USD' })
  currency: string;

  /** Snapshot of the purchased items at checkout time. */
  @Prop({ type: [TransactionItemSchema], required: true })
  items: TransactionItem[];

  @Prop({ type: String, enum: PAYMENT_METHODS, default: null })
  paymentMethod: PaymentMethod | null;

  @Prop({ type: String, default: null })
  failureReason: string | null;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
