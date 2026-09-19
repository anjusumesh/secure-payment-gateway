import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirror main.ts's bootstrap() — a TestingModule app doesn't get it automatically.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  it('GET /items returns the catalog as an array', () => {
    return request(app.getHttpServer())
      .get('/items')
      .expect(200)
      .expect((res) => {
        if (!Array.isArray(res.body)) {
          throw new Error('Expected /items to return an array');
        }
      });
  });

  it('GET /transactions returns an array', () => {
    return request(app.getHttpServer())
      .get('/transactions')
      .expect(200)
      .expect((res) => {
        if (!Array.isArray(res.body)) {
          throw new Error('Expected /transactions to return an array');
        }
      });
  });

  it('POST /payment/create-order with an empty cart is rejected', () => {
    return request(app.getHttpServer())
      .post('/payment/create-order')
      .send({ items: [] })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
