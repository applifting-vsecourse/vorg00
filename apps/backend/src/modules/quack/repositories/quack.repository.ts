import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import {
  BadRequestException,
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
  quack: PrismaQuack & { user?: PrismaUser; poll?: LoadedPoll | null },
): Quack => ({
  id: quack.id,
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

/**
 * If you decide to choose a different ORM or database, you should only need to change the repository files methods implementation.
 * Inject what you need instead of PrismaService and re-implement the methods and model mapping.
 */
@Injectable()
export class QuackRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getQuacks(
    search?: string,
    viewerId?: string,
    authorId?: string,
  ): Promise<Quack[]> {
    // Prisma's contains uses LIKE patterns; user punctuation must stay literal.
    const contains = search?.replace(/[\\%_]/g, '\\$&');
    const quacks = await this.prisma.quack.findMany({
      where: {
        ...(authorId ? { userId: authorId } : {}),
        ...(contains
          ? {
              OR: [
                { text: { contains, mode: 'insensitive' as const } },
                { user: { name: { contains, mode: 'insensitive' as const } } },
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
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: QuackMood | null;
    pollOptions?: string[];
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        ...(createQuackData.pollOptions
          ? {
              poll: {
                create: {
                  options: {
                    create: createQuackData.pollOptions.map(
                      (label, position) => ({ label, position }),
                    ),
                  },
                },
              },
            }
          : {}),
        user: { connect: { id: createQuackData.userId } },
      },
      include: includeForViewer(createQuackData.userId),
    });
    return mapPrismaQuackToDomain(quack);
  }
  async vote(
    quackId: string,
    userId: string,
    optionId: string,
  ): Promise<Quack> {
    const poll = await this.prisma.poll.findUnique({
      where: { quackId },
      select: { options: { select: { id: true } } },
    });
    if (!poll) throw new NotFoundException('Poll not found');
    if (!poll.options.some((option) => option.id === optionId))
      throw new BadRequestException('Choose an answer from this poll');
    await this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: quackId, userId } },
      create: { pollId: quackId, userId, optionId },
      update: { optionId },
    });
    const quack = await this.prisma.quack.findUnique({
      where: { id: quackId },
      include: includeForViewer(userId),
    });
    if (!quack) throw new NotFoundException('Poll not found');
    return mapPrismaQuackToDomain(quack);
  }
  async findById(id: string): Promise<Quack | null> {
    const quack = await this.prisma.quack.findUnique({ where: { id } });
    return quack ? mapPrismaQuackToDomain(quack) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.quack.deleteMany({ where: { id } });
  }
}
