import { PrismaService } from '@/core/prisma/prisma.service';
import {
  Quack as PrismaQuack,
  User as PrismaUser,
} from '@/generated/prisma/client';
import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { Injectable } from '@nestjs/common';

const mapPrismaQuackToDomain = (
  quack: PrismaQuack & { user?: PrismaUser },
): Quack => ({
  id: quack.id,
  text: quack.text,
  mood: quack.mood,
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

  async getQuacks(search?: string): Promise<Quack[]> {
    // Prisma's contains uses LIKE patterns; user punctuation must stay literal.
    const contains = search?.replace(/[\\%_]/g, '\\$&');
    const quacks = await this.prisma.quack.findMany({
      ...(contains
        ? {
            where: {
              OR: [
                { text: { contains, mode: 'insensitive' as const } },
                { user: { name: { contains, mode: 'insensitive' as const } } },
                {
                  user: {
                    username: { contains, mode: 'insensitive' as const },
                  },
                },
              ],
            },
          }
        : {}),
      include: { user: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return quacks.map(mapPrismaQuackToDomain);
  }

  async createQuack(createQuackData: {
    text: string;
    mood?: QuackMood | null;
    userId: string;
  }): Promise<Quack> {
    const quack = await this.prisma.quack.create({
      data: {
        text: createQuackData.text,
        mood: createQuackData.mood,
        user: { connect: { id: createQuackData.userId } },
      },
      include: { user: true },
    });
    return mapPrismaQuackToDomain(quack);
  }
}
