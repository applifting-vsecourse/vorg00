import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(
    search?: string,
    viewerId?: string,
    scope: 'all' | 'mine' = 'all',
  ): Promise<Quack[]> {
    return this.quackRepository.getQuacks(
      search?.trim() || undefined,
      viewerId,
      scope === 'mine' ? viewerId : undefined,
    );
  }

  async createQuack(
    user: Identity,
    quackData: {
      text: string;
      parentId?: string;
      mood?: QuackMood | null;
      pollOptions?: string[];
    },
  ): Promise<Quack> {
    if (quackData.parentId && (quackData.pollOptions || quackData.mood))
      throw new BadRequestException('Replies are text-only.');
    const text = quackData.text.trim();
    if (!text || Array.from(text).length > 280)
      throw new BadRequestException('Text must contain 1–280 characters.');
    return this.quackRepository.createQuack({
      text,
      ...(quackData.parentId ? { parentId: quackData.parentId } : {}),
      ...(quackData.mood === undefined ? {} : { mood: quackData.mood }),
      ...(quackData.pollOptions ? { pollOptions: quackData.pollOptions } : {}),
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }

  getQuack(id: string, user: Identity): Promise<Quack> {
    return this.quackRepository.getQuack(id, user.id);
  }

  getReplies(
    id: string,
    user: Identity,
    cursor?: string,
  ): Promise<{ items: Quack[]; nextCursor: string | null }> {
    return this.quackRepository.getReplies(id, user.id, cursor);
  }

  vote(user: Identity, quackId: string, optionId: string): Promise<Quack> {
    return this.quackRepository.vote(quackId, user.id, optionId);
  }
  async delete(user: Identity, quackId: string): Promise<void> {
    const quack = await this.quackRepository.getQuack(quackId, user.id);
    if (quack.deletedAt) return;
    const isOwner = quack.userId === user.id;
    const isAdmin = user.role === 'admin';
    if (!isOwner && !isAdmin)
      throw new ForbiddenException(
        'Only the author or an admin can delete this quack',
      );
    await this.quackRepository.deleteQuack(quackId, user);
  }
}
