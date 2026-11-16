export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type Quack = {
  id: string;
  text: string | null;
  mood?: QuackMood | null;
  poll?: {
    options: { id: string; label: string; count: number | null }[];
    selectedOptionId: string | null;
    totalVotes: number | null;
  } | null;
  userId: string | null;
  parentId: string | null;
  deletedAt: Date | null;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
};
