export type LikeState = { likeCount: number; likedByMe: boolean };

// Persistence boundary for the future service; implementations are not added yet.
export interface LikesStore {
  findQuack(quackId: string): Promise<{ id: string; userId: string } | null>;
  add(quackId: string, userId: string): Promise<void>;
  remove(quackId: string, userId: string): Promise<void>;
  getState(quackId: string, userId: string): Promise<LikeState>;
}

export class LikesService {
  constructor(readonly store: LikesStore) {}

  // Parameters define the future contract; the red-phase stub intentionally ignores them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async like(userId: string, quackId: string): Promise<LikeState> {
    throw new Error('not implemented');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async unlike(userId: string, quackId: string): Promise<LikeState> {
    throw new Error('not implemented');
  }
}
