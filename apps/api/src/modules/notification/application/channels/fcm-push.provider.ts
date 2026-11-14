import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationChannel } from '../../domain/notification-events';
import {
  ChannelMessage,
  ChannelProvider,
  DeliveryResult,
} from './channel-provider.port';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const fcmUrl = (projectId: string) =>
  `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

/**
 * Firebase Cloud Messaging push channel (PRD §20.1, MVP). Talks the **FCM HTTP
 * v1 API** directly — a service-account OAuth token minted with Node `crypto`
 * (RS256 JWT), no `firebase-admin` SDK and no extra dependencies. Credentials are
 * loaded from the JSON file at `FIREBASE_CREDENTIALS_PATH`; if that's unset or
 * unreadable the provider reports `isConfigured() === false` and the engine
 * simply defers push (in-app still delivers). Sends to every device token the
 * user has registered (`DeviceToken`) and prunes tokens FCM reports as stale.
 */
@Injectable()
export class FcmPushProvider implements ChannelProvider {
  readonly channel: NotificationChannel = 'push';

  private readonly log: LoggerService;
  private readonly creds: ServiceAccount | null;
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FcmPushProvider.name);
    this.creds = this.loadCredentials();
  }

  isConfigured(): boolean {
    return this.creds !== null;
  }

  async send(msg: ChannelMessage): Promise<DeliveryResult> {
    if (!this.creds) return { delivered: false, detail: 'not_configured' };

    const devices = await this.prisma.deviceToken.findMany({
      where: { userId: msg.userId },
      select: { id: true, token: true },
    });
    if (devices.length === 0) return { delivered: false, detail: 'no_devices' };

    const token = await this.getAccessToken();
    if (!token) return { delivered: false, detail: 'auth_failed' };

    let success = 0;
    const stale: string[] = [];
    for (const device of devices) {
      const ok = await this.sendToToken(token, device.token, msg);
      if (ok === 'sent') success += 1;
      else if (ok === 'stale') stale.push(device.id);
    }
    if (stale.length > 0) {
      await this.prisma.deviceToken.deleteMany({
        where: { id: { in: stale } },
      });
    }
    return {
      delivered: success > 0,
      detail: `${success}/${devices.length} tokens`,
    };
  }

  // ---- internals ----------------------------------------------------------

  private async sendToToken(
    accessToken: string,
    deviceToken: string,
    msg: ChannelMessage,
  ): Promise<'sent' | 'stale' | 'failed'> {
    try {
      const res = await fetch(fcmUrl(this.creds!.project_id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: msg.title, body: msg.message },
            data: {
              link: msg.link ?? '',
              eventKey: msg.eventKey,
              category: msg.category,
              priority: msg.priority,
            },
            android: { priority: 'high' },
          },
        }),
      });
      if (res.ok) return 'sent';

      const body = (await res.json().catch(() => ({}))) as {
        error?: { status?: string; details?: { errorCode?: string }[] };
      };
      const unregistered =
        body.error?.status === 'NOT_FOUND' ||
        body.error?.details?.some((d) => d.errorCode === 'UNREGISTERED');
      this.log.warn('FCM send rejected', {
        status: res.status,
        fcmStatus: body.error?.status,
      });
      return unregistered ? 'stale' : 'failed';
    } catch (err) {
      this.log.warn('FCM send error', { err: (err as Error).message });
      return 'failed';
    }
  }

  /** OAuth2 access token for the service account, cached until shortly before expiry. */
  private async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }
    try {
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: this.creds!.client_email,
        scope: FCM_SCOPE,
        aud: this.creds!.token_uri,
        iat: now,
        exp: now + 3600,
      };
      const signingInput = `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url(claim)}`;
      const signature = createSign('RSA-SHA256')
        .update(signingInput)
        .sign(this.creds!.private_key, 'base64url');
      const assertion = `${signingInput}.${signature}`;

      const res = await fetch(this.creds!.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
      });
      if (!res.ok) {
        this.log.warn('FCM token mint failed', { status: res.status });
        return null;
      }
      const json = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };
      this.accessToken = {
        value: json.access_token,
        expiresAt: Date.now() + (json.expires_in - 60) * 1000,
      };
      return this.accessToken.value;
    } catch (err) {
      this.log.warn('FCM token mint error', { err: (err as Error).message });
      return null;
    }
  }

  private loadCredentials(): ServiceAccount | null {
    const path = process.env.FIREBASE_CREDENTIALS_PATH;
    if (!path) {
      this.log.info(
        'FIREBASE_CREDENTIALS_PATH not set — push channel disabled',
      );
      return null;
    }
    try {
      const raw = readFileSync(resolve(process.cwd(), path), 'utf8');
      const json = JSON.parse(raw) as Partial<ServiceAccount>;
      if (!json.project_id || !json.client_email || !json.private_key) {
        this.log.warn('Firebase credentials missing required fields');
        return null;
      }
      this.log.info('FCM push channel configured', {
        projectId: json.project_id,
      });
      return {
        project_id: json.project_id,
        client_email: json.client_email,
        private_key: json.private_key,
        token_uri: json.token_uri ?? 'https://oauth2.googleapis.com/token',
      };
    } catch (err) {
      this.log.warn('Could not load Firebase credentials', {
        err: (err as Error).message,
      });
      return null;
    }
  }
}

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
