import { IsMongoId } from 'class-validator';

export class CancelPaymentDto {
  @IsMongoId()
  transactionId: string;
}
