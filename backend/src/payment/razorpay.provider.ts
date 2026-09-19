import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

export const RAZORPAY_CLIENT = 'RAZORPAY_CLIENT';

export const razorpayClientProvider = {
  provide: RAZORPAY_CLIENT,
  useFactory: (configService: ConfigService) =>
    new Razorpay({
      key_id: configService.getOrThrow<string>('RAZORPAY_KEY_ID'),
      key_secret: configService.getOrThrow<string>('RAZORPAY_KEY_SECRET'),
    }),
  inject: [ConfigService],
};
