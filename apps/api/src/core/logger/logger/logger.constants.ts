export const LOGGER_CONTEXT_TOKEN = 'LOGGER_CONTEXT';

export const SENSITIVE_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'req.headers["x-api-key"]',
  'req.body.password',
  'req.body.confirmPassword',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.body.authorization',
  'req.body.otp',
  'req.body.nid',
  'req.body.nidNumber',
  'req.body.identityNumber',
  'req.body.secret',
  'req.body.creditCard',
  'req.body.ssn',
];

export const LOG_LEVELS = [
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
