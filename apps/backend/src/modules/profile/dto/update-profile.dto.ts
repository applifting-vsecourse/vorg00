import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateProfileDto {
  @ApiProperty({ minLength: 3, maxLength: 30 })
  @Transform(trim)
  @IsString()
  @Matches(/^[a-zA-Z0-9._]{3,30}$/, {
    message: 'Username must be 3–30 letters, numbers, dots or underscores',
  })
  username!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Display name is required' })
  @MaxLength(100)
  name!: string;

  @ApiProperty({ maxLength: 160 })
  @Transform(trim)
  @IsString()
  @MaxLength(160)
  bio!: string;

  @ApiPropertyOptional({ enum: QUACK_MOODS, nullable: true })
  @IsOptional()
  @IsIn(QUACK_MOODS)
  defaultMood?: QuackMood | null;
}
