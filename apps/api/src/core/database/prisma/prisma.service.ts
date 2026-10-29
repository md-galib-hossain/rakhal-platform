import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { databaseConfig } from 'src/core/config/env';
import { txStore } from './tx-context';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly pool: Pool;

  constructor(
    @Inject(databaseConfig.KEY)
    dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    const pool = new Pool({
      connectionString: dbConfig.url,
      max: 25,
      idleTimeoutMillis: 30000,
    });
    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;

    // RAKHAL-481: inside `txStore.run(...)` every delegate / raw query /
    // `$transaction` joins the surrounding transaction; otherwise a no-op.
    return new Proxy(this, {
      get(target, prop, receiver) {
        const store = txStore.getStore();
        if (store && typeof prop === 'string') {
          const tx = store.tx as unknown as Record<string, unknown>;
          if (prop === '$transaction') {
            return async (arg: unknown) => {
              if (typeof arg === 'function') {
                return (arg as (t: unknown) => Promise<unknown>)(store.tx);
              }
              const out: unknown[] = [];
              for (const p of arg as Promise<unknown>[]) out.push(await p);
              return out;
            };
          }
          if (prop in tx) {
            const v = tx[prop];
            return (
              typeof v === 'function' && prop.startsWith('$')
                ? (v as (...a: unknown[]) => unknown).bind(store.tx)
                : v
            ) as unknown;
          }
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
