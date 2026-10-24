import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
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
      mood?: QuackMood | null;
      pollOptions?: string[];
    },
  ): Promise<Quack> {
    return this.quackRepository.createQuack({
      text: quackData.text,
      ...(quackData.mood === undefined ? {} : { mood: quackData.mood }),
      ...(quackData.pollOptions ? { pollOptions: quackData.pollOptions } : {}),
      // the author is taken from the session, never from the request body
      userId: user.id,
    });
  }

  vote(user: Identity, quackId: string, optionId: string): Promise<Quack> {
    return this.quackRepository.vote(quackId, user.id, optionId);
  }
  async delete(user: Identity, quackId: string): Promise<void> {
    const quack = await this.quackRepository.findById(quackId);
    if (!quack) throw new NotFoundException('Quack not found');
    if (quack.userId !== user.id)
      throw new ForbiddenException('You can only delete your own quacks');
    await this.quackRepository.deleteById(quackId);
  }
}
