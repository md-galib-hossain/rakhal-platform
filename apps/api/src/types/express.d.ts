import 'express';
import 'express-serve-static-core';
import type { AuthTokenPayload } from 'src/modules/auth/domain/auth-token-payload.type';
import type { AuthenticatedRequestContext } from 'src/modules/auth/domain/authenticated-request-context.type';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    traceId?: string;
    cookies?: Record<string, string | undefined>;
    user?: AuthTokenPayload;
    auth?: AuthenticatedRequestContext;
  }
}

declare module 'express' {
  interface Request {
    requestId?: string;
    traceId?: string;
    cookies?: Record<string, string | undefined>;
    user?: AuthTokenPayload;
    auth?: AuthenticatedRequestContext;
  }
}
