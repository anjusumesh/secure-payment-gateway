import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { toIdJson } from '../../common/mongoose/to-json-transform.js';

export type ItemDocument = HydratedDocument<Item>;

@Schema({ timestamps: true, toJSON: { transform: toIdJson } })
export class Item {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({ type: String, required: true })
  imageUrl: string;

  /** Integer, smallest currency unit (paise) — see specs/backend-spec.md Data Model. */
  @Prop({ type: Number, required: true, min: 1 })
  price: number;
}

export const ItemSchema = SchemaFactory.createForClass(Item);
