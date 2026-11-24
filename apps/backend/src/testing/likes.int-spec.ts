import { strict as assert } from 'node:assert';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { PrismaService } from '@/core/prisma/prisma.service';
import { createApp } from '@/create-app';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

type Actor = {
  id: string;
  email: string;
  client: ReturnType<typeof request.agent>;
};
const password = 'likes-integration-password';
const endpoint = (id: string): string => `/api/quacks/${id}/like`;

void describe('Likes API (cases.md)', () => {
  let app: INestApplication;
  let db: PrismaService;
  let alice: Actor;
  let bob: Actor;
  let quackId: string;
  let ownQuackId: string;

  before(async () => {
    assert.equal(new URL(process.env.DATABASE_URL!).pathname, '/quacker_test');
    app = await createApp();
    await app.init();
    db = app.get(PrismaService);
  });

  async function clean(): Promise<void> {
    const tables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    `;
    const names = tables.map(
      ({ tablename }) => `"public"."${tablename.replace(/"/g, '""')}"`,
    );
    if (names.length)
      await db.$executeRawUnsafe(
        `TRUNCATE TABLE ${names.join(', ')} RESTART IDENTITY CASCADE`,
      );
  }

  async function actor(name: string): Promise<Actor> {
    const client = request.agent(app.getHttpServer());
    const email = `${name}@example.com`;
    const signup = await client
      .post('/api/auth/sign-up/email')
      .send({ name, username: name, email, password })
      .expect(200);
    await client
      .post('/api/auth/sign-in/email')
      .send({ email, password })
      .expect(200);
    return { id: signup.body.user.id, email, client };
  }

  beforeEach(async () => {
    await clean();
    alice = await actor('likesalice');
    bob = await actor('likesbob');
    quackId = (
      await db.quack.create({ data: { text: 'Bob’s quack', userId: bob.id } })
    ).id;
    ownQuackId = (
      await db.quack.create({
        data: { text: 'Alice’s quack', userId: alice.id },
      })
    ).id;
  });
  afterEach(async () => {
    if (db) await clean();
  });
  after(async () => {
    if (app) await app.close();
  });

  // These helpers are used inside test bodies, never in setup hooks: missing
  // likes behaviour is an assertion failure, not a failed fixture hook.
  async function like(user: Actor, id = quackId): Promise<void> {
    const response = await user.client.put(endpoint(id));
    assert.equal(response.status, 200, 'like must succeed');
  }
  async function state(
    user: Actor,
    id: string,
    count: number,
    liked: boolean,
  ): Promise<void> {
    const response = await user.client.get('/api/quacks').expect(200);
    const quack = response.body.find((item: { id: string }) => item.id === id);
    assert.ok(quack, 'fixture quack is present in the real feed');
    assert.equal(
      quack.likeCount,
      count,
      'feed must report the stored like count',
    );
    assert.equal(
      quack.likedByMe,
      liked,
      'feed must report this session’s like state',
    );
  }
  async function storedLikers(id: string, expected: string[]): Promise<void> {
    // Avoid a SQL/setup exception before the missing migration is implemented.
    const tables = await db.$queryRaw<
      { name: string | null }[]
    >`SELECT to_regclass('public.like')::text AS name`;
    assert.ok(
      tables[0].name,
      'Like rows must be persisted in public.like (ADR 0002)',
    );
    const rows = await db.$queryRaw<
      { userId: string }[]
    >`SELECT "userId" FROM "like" WHERE "quackId" = ${id}`;
    assert.deepEqual(
      rows.map((row) => row.userId).sort(),
      [...expected].sort(),
    );
  }

  for (const operation of ['feed', 'like', 'unlike'] as const) {
    void it(`I1: signed-out ${operation} returns 401 and changes no likes`, async () => {
      const visitor = request(app.getHttpServer());
      const response =
        operation === 'feed'
          ? await visitor.get('/api/quacks')
          : operation === 'like'
            ? await visitor.put(endpoint(quackId))
            : await visitor.delete(endpoint(quackId));
      assert.equal(response.status, 401);
      assert.equal(
        JSON.stringify(response.body).includes('Bob’s quack'),
        false,
      );
      assert.equal('likeCount' in response.body, false);
      await state(alice, quackId, 0, false);
      await storedLikers(quackId, []);
    });
  }

  void it('I2: two users see the same totals but their own liked state', async () => {
    await state(alice, ownQuackId, 0, false);
    await like(alice);
    for (const user of [alice, bob]) {
      await state(user, ownQuackId, 0, false);
      await state(user, quackId, 1, user.id === alice.id);
    }
    await storedLikers(quackId, [alice.id]);
    await storedLikers(ownQuackId, []);
  });

  for (const owner of ['another user', 'self']) {
    void it(`I3: authenticated like/unlike round trip on a quack owned by ${owner}`, async () => {
      const id = owner === 'self' ? ownQuackId : quackId;
      await like(alice, id);
      await state(alice, id, 1, true);
      await storedLikers(id, [alice.id]);
      await alice.client.delete(endpoint(id)).expect(200);
      await state(alice, id, 0, false);
      await storedLikers(id, []);
    });
  }

  for (const concurrent of [false, true]) {
    void it(`I4: repeated likes are idempotent (${concurrent ? 'concurrent' : 'sequential'})`, async () => {
      const send = (): Promise<request.Response> =>
        alice.client.put(endpoint(quackId)).then((response) => response);
      const responses = concurrent
        ? await Promise.all([send(), send()])
        : [await send(), await send()];
      assert.deepEqual(
        responses.map((response) => response.status),
        [200, 200],
      );
      await state(alice, quackId, 1, true);
      await storedLikers(quackId, [alice.id]);
    });
    for (const alreadyLiked of [false, true]) {
      void it(`I5: repeated unlikes (${concurrent ? 'concurrent' : 'sequential'}, initially ${alreadyLiked ? 'liked' : 'unliked'})`, async () => {
        if (alreadyLiked) await like(alice);
        const send = (): Promise<request.Response> =>
          alice.client.delete(endpoint(quackId)).then((response) => response);
        const responses = concurrent
          ? await Promise.all([send(), send()])
          : [await send(), await send()];
        assert.deepEqual(
          responses.map((response) => response.status),
          [200, 200],
        );
        await state(alice, quackId, 0, false);
        await storedLikers(quackId, []);
        // Repeat with another user's like present, which must survive both calls.
        await like(bob);
        if (alreadyLiked) await like(alice);
        const again = concurrent
          ? await Promise.all([send(), send()])
          : [await send(), await send()];
        assert.deepEqual(
          again.map((response) => response.status),
          [200, 200],
        );
        await state(alice, quackId, 1, false);
        await state(bob, quackId, 1, true);
        await storedLikers(quackId, [bob.id]);
      });
    }
  }

  for (const forgedIdentity of [false, true]) {
    void it(`I6: Alice cannot remove Bob’s like (${forgedIdentity ? 'forged body identity' : 'ordinary unlike'})`, async () => {
      await like(bob);
      const response = await alice.client
        .delete(endpoint(quackId))
        .send(forgedIdentity ? { userId: bob.id } : {});
      // Rejecting an unsupported identity field or ignoring it are both safe.
      assert.ok(
        (forgedIdentity ? [200, 400, 403] : [200]).includes(response.status),
        `unexpected status ${response.status}`,
      );
      await state(bob, quackId, 1, true);
      await state(alice, quackId, 1, false);
      await storedLikers(quackId, [bob.id]);
    });
  }

  void it('I7: concurrent likes from different users both persist', async () => {
    const responses = await Promise.all([
      alice.client.put(endpoint(quackId)),
      bob.client.put(endpoint(quackId)),
    ]);
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200],
    );
    await state(alice, quackId, 2, true);
    await state(bob, quackId, 2, true);
    await storedLikers(quackId, [alice.id, bob.id]);
  });

  void it('I8: liking a deleted quack returns 404 without saving a like', async () => {
    // The current schema has physical deletion; no placeholder implementation is added here.
    await db.quack.delete({ where: { id: quackId } });
    assert.equal(await db.quack.count({ where: { id: quackId } }), 0);
    await alice.client.put(endpoint(quackId)).expect(404);
    await storedLikers(quackId, []);
  });

  void it('I9: likes survive reads, sign-out, and a fresh sign-in', async () => {
    await like(alice);
    await state(alice, quackId, 1, true);
    await alice.client.post('/api/auth/sign-out').send({}).expect(200);
    await alice.client.get('/api/quacks').expect(401);
    await storedLikers(quackId, [alice.id]);
    const fresh = request.agent(app.getHttpServer());
    await fresh
      .post('/api/auth/sign-in/email')
      .send({ email: alice.email, password })
      .expect(200);
    await state({ ...alice, client: fresh }, quackId, 1, true);
    await storedLikers(quackId, [alice.id]);
  });
});
