import { IsMongoId, IsString } from 'class-validator';

export class VerifyPaymentDto {
  @IsMongoId()
  transactionId: string;

  @IsString()
  razorpayOrderId: string;

  @IsString()
  razorpayPaymentId: string;

  @IsString()
  razorpaySignature: string;
}
