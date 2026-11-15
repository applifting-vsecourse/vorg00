import { randomUUID } from 'node:crypto';
import { PrismaService } from '@/core/prisma/prisma.service';
import { QuackResponseDto } from '@/modules/quack/controllers/dto/quack.response.dto';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { QuacksService } from '@/modules/quack/services/quacks.service';
import { Identity } from '@/shared/auth/domain/identity';

// Run against a disposable, migrated database only. CI provisions its own Postgres.
const databaseTests = process.env.TEST_DATABASE_URL ? describe : describe.skip;
databaseTests('Replies with PostgreSQL', () => {
  let db: PrismaService;
  let repository: QuackRepository;
  let service: QuacksService;
  let alice: Identity;
  let bob: Identity;
  let admin: Identity;
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    db = new PrismaService();
    await db.$connect();
    repository = new QuackRepository(db);
    service = new QuacksService(repository);
    const users = await Promise.all(
      ['Alice', 'Bob', 'Admin'].map((name) =>
        db.user.create({
          data: {
            id: randomUUID(),
            name,
            email: `${randomUUID()}@example.test`,
            emailVerified: true,
            role: name === 'Admin' ? 'admin' : 'user',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        }),
      ),
    );
    [alice, bob, admin] = users.map(
      (u) => new Identity(u.id, u.email, u.name, u.role),
    );
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it('erases a poll root while preserving replies and excluding content from search and every response', async () => {
    const secret = `erase-${randomUUID()}`;
    const root = await service.createQuack(alice, {
      text: secret,
      mood: 'happy',
      pollOptions: ['one', 'two'],
    });
    await service.vote(bob, root.id, root.poll!.options[0].id);
    const child = await service.createQuack(bob, {
      text: 'Surviving reply',
      parentId: root.id,
    });
    const grandchild = await service.createQuack(alice, {
      text: 'Nested reply',
      parentId: child.id,
    });
    expect((await repository.getQuack(root.id)).replyCount).toBe(2);
    await service.delete(alice, root.id);
    const row = await db.quack.findUniqueOrThrow({ where: { id: root.id } });
    expect(row).toMatchObject({
      text: null,
      userId: null,
      mood: null,
      parentId: null,
    });
    expect(row.deletedAt).toBeInstanceOf(Date);
    expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
    expect(await db.pollOption.count({ where: { pollId: root.id } })).toBe(0);
    expect(await db.pollVote.count({ where: { pollId: root.id } })).toBe(0);
    const detail = QuackResponseDto.fromDomain(
      await repository.getQuack(root.id),
      alice,
    );
    expect(detail).toMatchObject({
      deleted: true,
      text: null,
      user: null,
      userId: null,
      createdAt: null,
      poll: null,
      mood: null,
      canReply: false,
      canDelete: false,
      replyCount: 2,
    });
    expect(
      (await repository.getQuacks(undefined, bob.id)).some(
        (q) => q.id === root.id,
      ),
    ).toBe(true);
    expect(await repository.getQuacks(secret, bob.id)).toEqual([]);
    expect(
      (await repository.getReplies(root.id, bob.id)).items.map((q) => q.id),
    ).toEqual([child.id]);
    expect(
      (await repository.getReplies(child.id, bob.id)).items.map((q) => q.id),
    ).toEqual([grandchild.id]);
    expect(JSON.stringify(detail)).not.toContain(secret);
    await expect(
      service.createQuack(bob, { text: 'Late', parentId: root.id }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(service.vote(bob, root.id, 'missing')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('retains deleted intermediates with live descendants and hides empty branches', async () => {
    const root = await service.createQuack(alice, { text: 'Tree' });
    const child = await service.createQuack(bob, {
      text: 'Middle',
      parentId: root.id,
    });
    const leaf = await service.createQuack(alice, {
      text: 'Leaf',
      parentId: child.id,
    });
    await service.delete(bob, child.id);
    expect(
      (await repository.getReplies(root.id, alice.id)).items[0],
    ).toMatchObject({ id: child.id, text: null, replyCount: 1 });
    await service.delete(alice, leaf.id);
    expect((await repository.getReplies(root.id, alice.id)).items).toEqual([]);
    await service.delete(alice, root.id);
    expect((await repository.getQuacks()).some((q) => q.id === root.id)).toBe(
      false,
    );
    expect((await repository.getQuack(root.id)).deletedAt).not.toBeNull();
    expect((await repository.getQuack(leaf.id)).parentId).toBe(child.id);
  });

  it('enforces author/admin permissions, including against the author of the root', async () => {
    const root = await service.createQuack(alice, { text: 'Owner root' });
    const child = await service.createQuack(bob, {
      text: 'Other owner',
      parentId: root.id,
    });
    await expect(service.delete(alice, child.id)).rejects.toMatchObject({
      status: 403,
    });
    expect((await repository.getQuack(child.id)).text).toBe('Other owner');
    await service.delete(admin, child.id);
    await service.delete(bob, child.id); // Repeating removal never reveals former ownership.
    expect((await repository.getQuack(child.id)).deletedAt).not.toBeNull();
  });

  it('paginates 20 visible children in a stable order through equal timestamps and deletion', async () => {
    const root = await service.createQuack(alice, { text: 'Pagination' });
    const children: { id: string }[] = [];
    for (let i = 0; i < 23; i++)
      children.push(
        await service.createQuack(bob, {
          text: `Reply ${i}`,
          parentId: root.id,
        }),
      );
    await db.quack.updateMany({
      where: { parentId: root.id },
      data: { createdAt: new Date('2026-01-01') },
    });
    await service.delete(bob, children[0].id);
    const first = await repository.getReplies(root.id, alice.id);
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    await service.delete(bob, first.nextCursor!);
    const second = await repository.getReplies(
      root.id,
      alice.id,
      first.nextCursor!,
    );
    expect(second.items).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((q) => q.id)).size,
    ).toBe(22);
    await expect(
      repository.getReplies(root.id, alice.id, root.id),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('counts arbitrary depth, crossing deleted nodes', async () => {
    const root = await service.createQuack(alice, { text: 'Deep root' });
    let parent = root;
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) {
      parent = await service.createQuack(bob, {
        text: `Depth ${i}`,
        parentId: parent.id,
      });
      ids.push(parent.id);
    }
    await service.delete(bob, ids[10]);
    expect((await repository.getQuack(root.id)).replyCount).toBe(24);
    expect((await repository.getQuack(ids[10])).replyCount).toBe(14);
  });

  it('serializes competing deletion, replies and voting without losing committed replies', async () => {
    for (let i = 0; i < 5; i++) {
      const root = await service.createQuack(alice, {
        text: 'Race',
        pollOptions: ['A', 'B'],
      });
      const results = await Promise.allSettled([
        service.createQuack(bob, { text: 'Racing reply', parentId: root.id }),
        service.vote(bob, root.id, root.poll!.options[0].id),
        service.delete(alice, root.id),
      ]);
      expect(results[2].status).toBe('fulfilled');
      const reply = results[0];
      const children = await repository.getReplies(root.id, bob.id);
      if (reply.status === 'fulfilled')
        expect(children.items.map((q) => q.id)).toContain(reply.value.id);
      else {
        expect(reply.reason).toMatchObject({ status: 409 });
        expect(children.items).toHaveLength(0);
      }
      expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
      expect(await db.pollVote.count({ where: { pollId: root.id } })).toBe(0);
    }
  });

  it('blocks raw account deletion and provides atomic cleanup without destroying other replies', async () => {
    const u = await db.user.create({
      data: {
        id: randomUUID(),
        name: 'Removed',
        email: `${randomUUID()}@example.test`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const actor = new Identity(u.id, u.email, u.name, u.role);
    const root = await service.createQuack(actor, {
      text: 'Account content',
      pollOptions: ['X', 'Y'],
    });
    const child = await service.createQuack(bob, {
      text: 'Other account reply',
      parentId: root.id,
    });
    await expect(
      db.user.delete({ where: { id: actor.id } }),
    ).rejects.toBeDefined();
    await repository.eraseAccount(actor.id);
    expect(await db.user.findUnique({ where: { id: actor.id } })).toBeNull();
    expect((await repository.getQuack(root.id)).text).toBeNull();
    expect((await repository.getQuack(child.id)).text).toBe(
      'Other account reply',
    );
    expect(await db.poll.count({ where: { quackId: root.id } })).toBe(0);
  });
});
