import { LikesService, LikesStore } from './likes.service';

// Only persistence is simulated. The service under test must perform the action.
function fixture(
  likers: string[] = [],
  author = 'bob',
): {
  service: LikesService;
  rows: Set<string>;
  store: LikesStore;
} {
  const rows = new Set(likers);
  const store: LikesStore = {
    findQuack: jest.fn(async () => ({ id: 'q1', userId: author })),
    add: jest.fn(async (_quackId, userId) => {
      rows.add(userId);
    }),
    remove: jest.fn(async (_quackId, userId) => {
      rows.delete(userId);
    }),
    getState: jest.fn(async (_quackId, userId) => ({
      likeCount: rows.size,
      likedByMe: rows.has(userId),
    })),
  };
  return { service: new LikesService(store), rows, store };
}

describe('Like rules (cases.md)', () => {
  it('U1: liking changes 0 to 1', async () => {
    const { service, rows } = fixture();
    await expect(service.like('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect([...rows]).toEqual(['alice']);
  });
  it('U2: the author can like their own quack', async () => {
    const { service, rows } = fixture([], 'alice');
    await expect(service.like('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect([...rows]).toEqual(['alice']);
  });
  it('U3: liking twice is successful and does not toggle off', async () => {
    const { service, rows } = fixture(['alice']);
    await expect(service.like('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect([...rows]).toEqual(['alice']);
  });
  it('U4: unliking changes 1 to 0', async () => {
    const { service, rows } = fixture(['alice']);
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(rows.size).toBe(0);
  });
  it('U5: unliking a never-liked quack succeeds at 0', async () => {
    const { service, rows } = fixture();
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(rows.size).toBe(0);
  });
  it('U5: repeating an unlike stays at 0', async () => {
    const { service, rows } = fixture(['alice']);
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    expect(rows.size).toBe(0);
  });
  it('U6: unliking removes only the actor from two likers', async () => {
    const { service, rows, store } = fixture(['alice', 'bob']);
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: false,
    });
    expect([...rows]).toEqual(['bob']);
    expect(store.remove).toHaveBeenCalledWith('q1', 'alice');
  });
  it('U7: a non-liker cannot remove another user’s like', async () => {
    const { service, rows } = fixture(['bob']);
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: false,
    });
    expect([...rows]).toEqual(['bob']);
  });
  it('U8: like, unlike, and like again leaves one active like', async () => {
    const { service, rows } = fixture();
    await expect(service.like('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    await expect(service.unlike('alice', 'q1')).resolves.toEqual({
      likeCount: 0,
      likedByMe: false,
    });
    await expect(service.like('alice', 'q1')).resolves.toEqual({
      likeCount: 1,
      likedByMe: true,
    });
    expect([...rows]).toEqual(['alice']);
  });
});
