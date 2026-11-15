// Example unit test — the pattern to copy for your own services.
// The repository is mocked, so the test exercises the service in isolation.
import { Quack } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { QuacksService } from './quacks.service';

const aQuack = (overrides: Partial<Quack> = {}): Quack => ({
  id: 'q1',
  parentId: null,
  deletedAt: null,
  replyCount: 0,
  text: 'quack quack',
  userId: 'u1',
  createdAt: new Date('2026-01-01T12:00:00Z'),
  updatedAt: new Date('2026-01-01T12:00:00Z'),
  user: { id: 'u1', name: 'Caffeinated Duck', username: 'CaffeinatedDuck' },
  ...overrides,
});

describe('QuacksService', () => {
  it('returns quacks from the repository', async () => {
    const quacks = [aQuack()];
    const repository = mock<QuackRepository>();
    repository.getQuacks.mockResolvedValue(quacks);

    const service = new QuacksService(repository);

    await expect(service.getQuacks()).resolves.toEqual(quacks);
    expect(repository.getQuacks).toHaveBeenCalledTimes(1);
  });

  it('creates a quack owned by the signed-in user', async () => {
    const created = aQuack({ id: 'q2', text: 'hello' });
    const repository = mock<QuackRepository>();
    repository.createQuack.mockResolvedValue(created);

    const service = new QuacksService(repository);
    const user = { id: 'u1' } as Identity;

    await expect(service.createQuack(user, { text: 'hello' })).resolves.toEqual(
      created,
    );
    // the author comes from the session, not from the caller's payload
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: 'hello',
      userId: 'u1',
    });
  });
});

// Service authorization must remain effective even if a repository implementation changes.
describe('Deletion authorization', () => {
  it('rejects a non-owner without invoking the deletion repository', async () => {
    const repository = mock<QuackRepository>();
    repository.getQuack.mockResolvedValue(aQuack());
    const service = new QuacksService(repository);
    await expect(
      service.delete(
        new Identity('other', 'other@example.test', 'Other', 'user'),
        'q1',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.deleteQuack).not.toHaveBeenCalled();
  });
  it('rejects polls and moods on replies and trims Unicode text', async () => {
    const repository = mock<QuackRepository>();
    const service = new QuacksService(repository);
    const user = new Identity('u1', 'u@example.test', 'User', 'user');
    await expect(
      service.createQuack(user, {
        text: 'reply',
        parentId: 'q1',
        pollOptions: ['A', 'B'],
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createQuack(user, {
        text: 'reply',
        parentId: 'q1',
        mood: 'happy',
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createQuack(user, { text: ' ', parentId: 'q1' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.createQuack(user, { text: '🦆'.repeat(281), parentId: 'q1' }),
    ).rejects.toMatchObject({ status: 400 });
    await service.createQuack(user, {
      text: ` ${'🦆'.repeat(280)} `,
      parentId: 'q1',
    });
    expect(repository.createQuack).toHaveBeenCalledWith({
      text: '🦆'.repeat(280),
      parentId: 'q1',
      userId: 'u1',
    });
  });
});
