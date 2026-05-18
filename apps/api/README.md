<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Environment

Create a local `.env` with project-specific values. Use strong, independent JWT secrets in every environment.

```bash
NODE_ENV=development
PORT=5000
APP_NAME=rakhal-api
APP_VERSION=1.0.0
API_PREFIX=api/v1

DATABASE_URL=postgresql://user:password@localhost:5432/rakhal

JWT_ACCESS_SECRET=replace-with-at-least-32-characters-access-secret
JWT_REFRESH_SECRET=replace-with-at-least-32-characters-refresh-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=
REDIS_PASSWORD=
REDIS_DATABASE=0
REDIS_TLS_ENABLED=false

ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1

AUTH_REFRESH_COOKIE_NAME=rakhal_refresh
AUTH_REFRESH_COOKIE_DOMAIN=
AUTH_REFRESH_COOKIE_PATH=/api/v1/auth
AUTH_REFRESH_COOKIE_SAME_SITE=lax
AUTH_REFRESH_COOKIE_SECURE=false

AUTH_CSRF_COOKIE_NAME=rakhal_csrf
AUTH_CSRF_HEADER_NAME=x-csrf-token
AUTH_CSRF_COOKIE_PATH=/api/v1/auth
AUTH_CSRF_COOKIE_SAME_SITE=lax
AUTH_CSRF_COOKIE_SECURE=false
AUTH_CSRF_SECRET=replace-with-at-least-32-characters-csrf-secret

RATE_LIMIT_TTL_SECONDS=60
RATE_LIMIT_MAX_REQUESTS=100
AUTH_LOGIN_RATE_LIMIT_TTL_SECONDS=60
AUTH_LOGIN_RATE_LIMIT_MAX_REQUESTS=5
AUTH_REFRESH_RATE_LIMIT_TTL_SECONDS=60
AUTH_REFRESH_RATE_LIMIT_MAX_REQUESTS=10

AUTH_LOCKOUT_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_WINDOW_SECONDS=900
AUTH_LOCKOUT_DURATION_SECONDS=900
```

## Auth Architecture

### System Overview

Rakhal uses short-lived JWT access tokens, rotating refresh tokens, HttpOnly cookies, Argon2id password hashing, Redis-backed cache helpers, and database-backed sessions. Authentication, tenant access, authorization, subscription access, and audit logging stay separate on purpose.

### Authentication Flow

`POST /auth/register` creates a user and a hashed email-verification token.

`POST /auth/login` verifies credentials, creates a device session, issues a minimal access token, and sets the refresh cookie.

`POST /auth/refresh` rotates the refresh token family, issues a new access token, and refreshes the cookie.

`POST /auth/logout` revokes the current session and clears the refresh cookie.

`POST /auth/logout-all` revokes every active session for the user.

### JWT Strategy

Access tokens only carry `sub`, `sessionId`, `farmId`, and `permissionsVersion`. Permissions and subscription entitlements stay out of the token.

### Refresh Rotation Flow

Refresh tokens are stored hashed only. Rotation revokes the old token, creates the next token in the same family, and records suspicious reuse as a compromised session event.

### Session Management

Sessions represent devices. The auth flow supports listing sessions, revoking one session, revoking all sessions, and marking reused refresh families as compromised.

### Farm Isolation Design

Farm-scoped routes must validate `userId + farmId` through `FarmMember` before the request reaches domain logic. Frontend-supplied `farmId` is never trusted on its own.

### RBAC Design

Permissions resolve from `User -> FarmMember -> Role -> RolePermission -> Permission`. Role names are labels only.

### Subscription Feature Gates

Subscription checks are independent from RBAC. A route can require both permission and subscription feature access.

### Middleware / Guards Flow

Public auth routes: request context middleware, logger middleware, throttler, optional CSRF guard, controller, service.

Protected routes: request context middleware, logger middleware, JWT guard, session guard, tenant guard, subscription guard, permission guard, controller, service.

### Redis Usage

Redis is used for permission caching, subscription feature caching, and rate limiting support. PostgreSQL remains the source of truth for users, sessions, memberships, and subscriptions.

### Audit Logging

Audit events are recorded for register, login, logout, session revocation, refresh reuse, and related sensitive operations. Raw secrets and raw tokens are never logged.

### Security Practices

- Use Argon2id for password hashing.
- Keep access tokens short lived.
- Keep refresh cookies HttpOnly and Secure in production.
- Keep SameSite explicit.
- Validate session state before trusting a JWT.
- Validate tenant membership before trusting farm data.
- Validate subscription separately from permissions.
- Use CSRF protection for cookie-authenticated state-changing routes.

### Folder Structure

```text
src/modules/auth/
  application/
  domain/
  dto/
  guards/
  repositories/
  strategies/
src/modules/tenant-access/
src/modules/permission/
src/modules/subscription/
src/modules/audit/
```

### Database Schema Notes

Auth uses `User`, `Session`, `RefreshToken`, and `AuthToken`. Tenant isolation uses `Farm` and `FarmMember`. Authorization uses `Role`, `RolePermission`, and `Permission`. Subscription entitlements use `FarmSubscription` and `SubscriptionFeature`. Audit events land in `AuditLog`.

### Environment Variables

The auth stack expects independent JWT secrets, explicit refresh-cookie and CSRF-cookie names, Argon2 settings, rate-limit values, and lockout values. `AUTH_CSRF_SECRET` should be set in real environments.

### Future Scalability

The current module split keeps auth, tenant access, permissions, subscriptions, and audit logging separable if these concerns are extracted into services later.

### Production Security Notes

Browser requests that rely on cookies must send credentials, and the frontend must send the CSRF token header on refresh/logout calls. Never store raw refresh tokens or passwords, and never put permissions or subscription state into JWTs.

### Postman Runbook

Use this flow to exercise the full auth stack from Postman. The important part is to keep cookies enabled, because refresh and CSRF protection both depend on the cookie jar.

1. Create a Postman environment with at least `baseUrl = http://localhost:5000`. If you are testing another host or port, update that one variable and keep the request paths unchanged.
2. Call `GET {{baseUrl}}/auth/csrf` first.
   - This sets the CSRF cookie and returns a CSRF token in the response body.
   - Save that token in a Postman environment variable such as `csrfToken`.
3. Register a user with `POST {{baseUrl}}/auth/register`.
   - Example body:
     ```json
     {
       "email": "jane.doe@example.com",
       "name": "Jane Doe",
       "password": "StrongPassword123!"
     }
     ```
   - The API returns the sanitized user record. The email verification token is handled internally and is not part of the Postman flow.
4. Log in with `POST {{baseUrl}}/auth/login`.
   - Example body:
     ```json
     {
       "email": "jane.doe@example.com",
       "password": "StrongPassword123!",
       "farmId": "your-farm-id"
     }
     ```
   - Keep Postman cookies enabled so the `rakhal_refresh` cookie is stored automatically.
   - Save the returned `accessToken` in a variable such as `accessToken`.
5. Use `Authorization: Bearer {{accessToken}}` for protected requests.
6. For any cookie-authenticated state-changing request, include the CSRF header.
   - Header name: `x-csrf-token`
   - Value: `{{csrfToken}}`
7. Refresh the session with `POST {{baseUrl}}/auth/refresh`.
   - Send the `farmId` you are working with.
   - Keep cookies enabled so the refresh token family rotates correctly.
   - Include `x-csrf-token: {{csrfToken}}`.
   - The response returns a fresh access token and updates the refresh cookie.
8. Check active sessions with `GET {{baseUrl}}/auth/sessions`.
   - Send `Authorization: Bearer {{accessToken}}`.
   - This confirms that login created a device session.
9. Revoke one session with `DELETE {{baseUrl}}/auth/sessions/:sessionId`.
   - Send `Authorization: Bearer {{accessToken}}`.
   - Include `x-csrf-token: {{csrfToken}}`.
   - Replace `:sessionId` with one of the session ids returned from the sessions endpoint.
10. Log out the current session with `POST {{baseUrl}}/auth/logout`.
    - Send `Authorization: Bearer {{accessToken}}`.
    - Include `x-csrf-token: {{csrfToken}}`.
    - You can optionally pass `sessionId` in the body if you want to target a specific session.
11. Log out every device with `POST {{baseUrl}}/auth/logout-all`.
    - Send `Authorization: Bearer {{accessToken}}`.
    - Include `x-csrf-token: {{csrfToken}}`.
    - This invalidates the full session set for the user.
12. Confirm the authenticated identity with `GET {{baseUrl}}/auth/me`.
    - Send `Authorization: Bearer {{accessToken}}`.
    - Use this after login or refresh to verify the token still matches the current session.

Practical Postman settings:

- Turn on cookie handling so Postman stores `rakhal_refresh` and `rakhal_csrf`.
- Keep the CSRF token in an environment variable and reuse it for refresh and logout requests.
- If you test from a separate frontend or proxy, keep requests aligned with the same origin and `credentials` behavior used by the app.
- In production, the cookies are expected to be `Secure`, so use HTTPS when you test production-like settings.

Common failure cases:

- `401 Unauthorized` usually means the access token expired, was not sent, or no longer matches a valid session.
- `403 Forbidden` with a CSRF message usually means the `x-csrf-token` header is missing or does not match the CSRF cookie.
- `404` or `403` on farm-scoped requests usually means the `farmId` is wrong or the user is not a member of that farm.
- `429 Too Many Requests` usually means throttling kicked in, which is expected on login and refresh endpoints.

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
