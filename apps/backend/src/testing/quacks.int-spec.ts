import { strict as assert } from 'node:assert';
import { after, before, beforeEach, describe, it } from 'node:test';
import { PrismaService } from '@/core/prisma/prisma.service';
import { createApp } from '@/create-app';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

void describe('GET /api/quacks', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  before(async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/quacker_test');
    app = await createApp();
    await app.init();
    prisma = app.get(PrismaService);
  });

  async function cleanDatabase(): Promise<void> {
    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const names = tables.map(
      ({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`,
    );
    if (names.length) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`,
      );
    }
  }

  beforeEach(cleanDatabase);
  after(async () => {
    try {
      if (prisma) await cleanDatabase();
    } finally {
      if (app) await app.close();
    }
  });

  void it('returns 401 for a signed-out visitor', async () => {
    await request(app.getHttpServer()).get('/api/quacks').expect(401);
  });

  void it('returns 200 and database quacks for a signed-in user', async () => {
    const visitor = request(app.getHttpServer());
    await visitor
      .post('/api/auth/sign-up/email')
      .send({
        name: 'Integration User',
        username: 'integration',
        email: 'integration@example.com',
        password: 'integration-password',
      })
      .expect(200);
    const user = request.agent(app.getHttpServer());
    await user
      .post('/api/auth/sign-in/email')
      .send({
        email: 'integration@example.com',
        password: 'integration-password',
      })
      .expect(200);
    await user.get('/api/quacks').expect(200, []);
    const created = await user
      .post('/api/quacks')
      .send({ text: 'A real database quack' })
      .expect(201);
    const response = await user.get('/api/quacks').expect(200);
    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].id, created.body.id);
    assert.equal(response.body[0].text, 'A real database quack');
  });
});
