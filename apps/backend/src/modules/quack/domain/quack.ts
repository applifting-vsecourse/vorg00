export const QUACK_MOODS = ['happy', 'sad', 'angry', 'silly'] as const;
export type QuackMood = (typeof QUACK_MOODS)[number];

export type QuackAuthor = {
  id: string;
  name: string;
  username: string;
};

export type Quack = {
  id: string;
  text: string;
  mood?: QuackMood | null;
  poll?: {
    options: { id: string; label: string; count: number | null }[];
    selectedOptionId: string | null;
    totalVotes: number | null;
  } | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  user?: QuackAuthor;
};
