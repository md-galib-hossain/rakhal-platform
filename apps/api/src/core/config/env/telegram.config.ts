import { registerAs } from '@nestjs/config';
import { env } from './env';

export const telegramConfig = registerAs('telegram', () => ({
  botToken: env.TELEGRAM_BOT_TOKEN,
  botUsername: env.TELEGRAM_BOT_USERNAME,
  webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
}));
