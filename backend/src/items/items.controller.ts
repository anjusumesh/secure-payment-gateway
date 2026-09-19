import { Controller, Get } from '@nestjs/common';
import { ItemsService } from './items.service.js';
import { ItemDocument } from './schemas/item.schema.js';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(): Promise<ItemDocument[]> {
    return this.itemsService.findAll();
  }
}
