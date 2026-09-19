import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Item, ItemDocument } from './schemas/item.schema.js';

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name) private readonly itemModel: Model<ItemDocument>,
  ) {}

  findAll(): Promise<ItemDocument[]> {
    return this.itemModel.find().exec();
  }

  findById(id: string): Promise<ItemDocument | null> {
    return this.itemModel.findById(id).exec();
  }
}
