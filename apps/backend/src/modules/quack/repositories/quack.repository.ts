import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Prisma,
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

const includeForViewer = (viewerId?: string) =>
  ({
    user: true,
    poll: {
      include: {
        options: {
          orderBy: { position: 'asc' as const },
          include: { _count: { select: { votes: true } } },
        },
        votes: {
          where: { userId: viewerId ?? '' },
          select: { optionId: true },
        },
      },
    },
  }) as const;

type LoadedPoll = {
  options: { id: string; label: string; _count: { votes: number } }[];
  votes: { optionId: string }[];
};
const mapPoll = (poll?: LoadedPoll | null): Quack['poll'] => {
  if (!poll) return null;
  const selectedOptionId = poll.votes[0]?.optionId ?? null;
  return {
    selectedOptionId,
    options: poll.options.map((option) => ({
      id: option.id,
      label: option.label,
      count: selectedOptionId ? option._count.votes : null,
    })),
    totalVotes: selectedOptionId
      ? poll.options.reduce((total, option) => total + option._count.votes, 0)
      : null,
  };
};

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser | null; poll?: LoadedPoll | null },
  replyCount = 0,
): Quack => ({
  id: quack.id,
  parentId: quack.parentId,
  deletedAt: quack.deletedAt,
  replyCount,
  text: quack.text,
  mood: quack.mood,
  poll: mapPoll(quack.poll),
  userId: quack.userId,
  createdAt: quack.createdAt,
  updatedAt: quack.updatedAt,
  user: quack.user
    ? {
        id: quack.user.id,
        name: quack.user.name,
        username: quack.user.username ?? '',
      }
    : undefined,
});

@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  // One snapshot covers count, visibility, and content; deleted intermediates are traversed.
  private read<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  private async counts(
    tx: Prisma.TransactionClient,
    ids: string[],
  ): Promise<Map<string, number>> {
    if (!ids.length) return new Map();
    const rows = await tx.$queryRaw<
      { root: string; count: bigint }[]
    >(Prisma.sql`
      WITH RECURSIVE descendants AS (
        SELECT "parentId" AS root, id, "deletedAt" FROM quack WHERE "parentId" IN (${Prisma.join(ids)})
        UNION ALL
        SELECT d.root, q.id, q."deletedAt" FROM quack q JOIN descendants d ON q."parentId" = d.id
      ) SELECT root, count(*) FILTER (WHERE "deletedAt" IS NULL) AS count FROM descendants GROUP BY root
    `);
    return new Map(rows.map((row) => [row.root, Number(row.count)]));
  }

  getQuacks(
    search?: string,
    viewerId?: string,
    authorId?: string,
  ): Promise<Quack[]> {
    return this.read(async (tx) => {
      // Prisma's contains uses LIKE patterns; user punctuation must stay literal.
      const contains = search?.replace(/[\\%_]/g, '\\$&');
      const quacks = await tx.quack.findMany({
        where: {
          parentId: null,
          ...(authorId ? { userId: authorId } : {}),
          ...(contains
            ? {
                deletedAt: null,
                OR: [
                  { text: { contains, mode: 'insensitive' as const } },
                  {
                    user: { name: { contains, mode: 'insensitive' as const } },
                  },
                  {
                    user: {
                      username: { contains, mode: 'insensitive' as const },
                    },
                  },
                ],
              }
            : {}),
        },
        include: includeForViewer(viewerId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const counts = await this.counts(
        tx,
        quacks.map((q) => q.id),
      );
      return quacks
        .filter((q) => !q.deletedAt || counts.get(q.id))
        .map((q) => mapPrismaQuackToDomain(q, counts.get(q.id)));
    });
  }

  getQuack(id: string, viewerId?: string): Promise<Quack> {
    return this.read(async (tx) => {
      const q = await tx.quack.findUnique({
        where: { id },
        include: includeForViewer(viewerId),
      });
      if (!q) throw new NotFoundException('Quack not found.');
      return mapPrismaQuackToDomain(q, (await this.counts(tx, [id])).get(id));
    });
  }

  getReplies(
    parentId: string,
    viewerId: string,
    cursor?: string,
  ): Promise<{ items: Quack[]; nextCursor: string | null }> {
    return this.read(async (tx) => {
      if (
        !(await tx.quack.findUnique({
          where: { id: parentId },
          select: { id: true },
        }))
      )
        throw new NotFoundException('Quack not found.');
      // IDs are opaque cursors. Retained rows keep their ordering tuple after deletion.
      const after = cursor
        ? await tx.quack.findUnique({ where: { id: cursor } })
        : null;
      if (cursor && (!after || after.parentId !== parentId))
        throw new BadRequestException('Invalid reply cursor.');
      const candidates = await tx.quack.findMany({
        where: {
          parentId,
          ...(after
            ? {
                OR: [
                  { createdAt: { lt: after.createdAt } },
                  { createdAt: after.createdAt, id: { lt: after.id } },
                ],
              }
            : {}),
        },
        select: { id: true, deletedAt: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      const counts = await this.counts(
        tx,
        candidates.map((q) => q.id),
      );
      const visible = candidates
        .filter((q) => !q.deletedAt || counts.get(q.id))
        .slice(0, 21);
      const ids = visible.slice(0, 20).map((q) => q.id);
      const items = await tx.quack.findMany({
        where: { id: { in: ids } },
        include: includeForViewer(viewerId),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      return {
        items: items.map((q) => mapPrismaQuackToDomain(q, counts.get(q.id))),
        nextCursor: visible.length > 20 ? ids[19] : null,
      };
    });
  }

  async createQuack(data: {
    text: string;
    userId: string;
    parentId?: string;
    mood?: QuackMood | null;
    pollOptions?: string[];
  }): Promise<Quack> {
    return this.prisma.$transaction(async (tx) => {
      // Account cleanup takes FOR UPDATE on this same row before visiting contributions.
      const author = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "user" WHERE id = ${data.userId} FOR KEY SHARE`;
      if (!author.length)
        throw new ForbiddenException('Account no longer exists.');
      if (data.parentId) {
        const targets = await tx.$queryRaw<
          PrismaQuack[]
        >`SELECT * FROM quack WHERE id = ${data.parentId} FOR UPDATE`;
        if (!targets[0]) throw new NotFoundException('Reply target not found.');
        if (targets[0].deletedAt)
          throw new ConflictException(
            'This quack was deleted. Your reply was not posted; your draft is preserved.',
          );
        if (data.pollOptions)
          throw new BadRequestException('Replies cannot contain polls.');
      }
      const q = await tx.quack.create({
        data: {
          text: data.text,
          userId: data.userId,
          parentId: data.parentId,
          mood: data.mood,
          ...(data.pollOptions
            ? {
                poll: {
                  create: {
                    options: {
                      create: data.pollOptions.map((label, position) => ({
                        label,
                        position,
                      })),
                    },
                  },
                },
              }
            : {}),
        },
        include: includeForViewer(data.userId),
      });
      return mapPrismaQuackToDomain(q);
    });
  }

  async deleteQuack(id: string, actor: Identity): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        PrismaQuack[]
      >`SELECT * FROM quack WHERE id = ${id} FOR UPDATE`;
      const q = rows[0];
      if (!q) throw new NotFoundException('Quack not found.');
      if (q.deletedAt) return;
      if (q.userId !== actor.id && actor.role !== 'admin')
        throw new ForbiddenException(
          'Only the author or an administrator can delete this quack.',
        );
      await tx.poll.deleteMany({ where: { quackId: id } });
      await tx.quack.update({
        where: { id },
        data: { text: null, userId: null, mood: null, deletedAt: new Date() },
      });
    });
  }

  // Internal orchestration for any future account-removal entry point; never expose without authorization.
  async eraseAccount(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM quack WHERE "userId" = ${userId} ORDER BY id FOR UPDATE`;
      await tx.poll.deleteMany({ where: { quack: { userId } } });
      await tx.quack.updateMany({
        where: { userId },
        data: { text: null, userId: null, mood: null, deletedAt: new Date() },
      });
      await tx.user.delete({ where: { id: userId } });
    });
  }

  async vote(
    quackId: string,
    userId: string,
    optionId: string,
  ): Promise<Quack> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR KEY SHARE`;
      const targets = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM quack WHERE id = ${quackId} AND "deletedAt" IS NULL FOR UPDATE`;
      if (!targets.length) throw new NotFoundException('Poll not found');
      const poll = await tx.poll.findUnique({
        where: { quackId },
        select: { options: { select: { id: true } } },
      });
      if (!poll) throw new NotFoundException('Poll not found');
      if (!poll.options.some((option) => option.id === optionId))
        throw new BadRequestException('Choose an answer from this poll');
      await tx.pollVote.upsert({
        where: { pollId_userId: { pollId: quackId, userId } },
        create: { pollId: quackId, userId, optionId },
        update: { optionId },
      });
      const q = await tx.quack.findUniqueOrThrow({
        where: { id: quackId },
        include: includeForViewer(userId),
      });
      return mapPrismaQuackToDomain(
        q,
        (await this.counts(tx, [quackId])).get(quackId),
      );
    });
  }
}
