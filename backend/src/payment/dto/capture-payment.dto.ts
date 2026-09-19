import { IsMongoId, IsString } from 'class-validator';

export class CapturePaymentDto {
  @IsMongoId()
  transactionId: string;

  @IsString()
  paypalOrderId: string;
}
