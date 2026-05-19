import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { ConfigType } from '@nestjs/config';
import { authConfig } from 'src/core/config/env';

@Injectable()
export class PasswordService {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  hashPassword(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: this.config.password.argon2MemoryCost,
      timeCost: this.config.password.argon2TimeCost,
      parallelism: this.config.password.argon2Parallelism,
    });
  }

  verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
    return argon2.verify(hash, plainPassword);
  }
}
