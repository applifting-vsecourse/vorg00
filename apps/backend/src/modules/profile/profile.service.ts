import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { QuackMood } from '@/modules/quack/domain/quack';
import { ConflictException, Injectable } from '@nestjs/common';

const profileSelect = {
  name: true,
  username: true,
  bio: true,
  defaultMood: true,
} satisfies Prisma.UserSelect;
type Profile = Prisma.UserGetPayload<{ select: typeof profileSelect }>;
type ProfileInput = {
  name: string;
  username: string;
  bio: string;
  defaultMood?: QuackMood | null;
};

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string): Promise<Profile> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: profileSelect,
    });
  }

  async update(userId: string, input: ProfileInput): Promise<Profile> {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: input.name,
          username: input.username.toLowerCase(),
          displayUsername: input.username,
          bio: input.bio || null,
          defaultMood: input.defaultMood ?? null,
        },
        select: profileSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          message: 'That username is already taken',
          field: 'username',
        });
      }
      throw error;
    }
  }
}
