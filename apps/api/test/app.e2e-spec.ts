import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/csrf (GET)', () => {
    return request(app.getHttpServer())
      .get('/auth/csrf')
      .expect(200)
      .expect(({ body, headers }) => {
        const typedBody = body as { csrfToken?: string };
        expect(typedBody.csrfToken).toEqual(expect.any(String));
        expect(headers['set-cookie']).toEqual(
          expect.arrayContaining([expect.stringContaining('rakhal_csrf')]),
        );
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
