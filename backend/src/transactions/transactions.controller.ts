import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { TransactionsService } from './transactions.service.js';
import { TransactionDocument } from './schemas/transaction.schema.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(): Promise<TransactionDocument[]> {
    return this.transactionsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<TransactionDocument> {
    const transaction = await this.transactionsService.findById(id);
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return transaction;
  }
}
