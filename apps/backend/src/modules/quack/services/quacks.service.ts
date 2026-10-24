import { Quack, QuackMood } from '@/modules/quack/domain/quack';
import { QuackRepository } from '@/modules/quack/repositories/quack.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class QuacksService {
  constructor(private readonly quackRepository: QuackRepository) {}

  async getQuacks(search?: string, viewerId?: string): Promise<Quack[]> {
    return this.quackRepository.getQuacks(
      search?.trim() || undefined,
      viewerId,
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
}
