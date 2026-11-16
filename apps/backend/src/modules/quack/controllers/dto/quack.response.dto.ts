import { Quack, QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { Identity } from '@/shared/auth/domain/identity';
import { ApiProperty } from '@nestjs/swagger';

class QuackUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() username!: string;
}

export class QuackResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: String, nullable: true }) parentId!: string | null;
  @ApiProperty({ type: String, nullable: true }) text!: string | null;
  @ApiProperty({ type: String, nullable: true }) userId!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  createdAt!: Date | null;
  @ApiProperty({ type: QuackUserDto, nullable: true })
  user!: QuackUserDto | null;
  @ApiProperty({ type: Object, nullable: true }) poll!: Quack['poll'];
  @ApiProperty({ enum: QUACK_MOODS, nullable: true }) mood!: QuackMood | null;
  @ApiProperty() deleted!: boolean;
  @ApiProperty() replyCount!: number;
  @ApiProperty() canReply!: boolean;
  @ApiProperty() canDelete!: boolean;

  static fromDomain(quack: Quack, actor: Identity): QuackResponseDto {
    const deleted = quack.deletedAt !== null;
    if (!deleted && !quack.user)
      throw new Error('Live quack author must be loaded.');
    return {
      id: quack.id,
      parentId: quack.parentId,
      deleted,
      replyCount: quack.replyCount,
      text: deleted ? null : quack.text,
      userId: deleted ? null : quack.userId,
      createdAt: deleted ? null : quack.createdAt,
      user: deleted ? null : quack.user!,
      poll: deleted ? null : quack.poll,
      mood: deleted ? null : (quack.mood ?? null),
      canReply: !deleted,
      canDelete:
        !deleted && (actor.id === quack.userId || actor.role === 'admin'),
    };
  }
}
