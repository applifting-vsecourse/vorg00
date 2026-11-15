import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CreateQuackDto } from './dto/create-quack.dto';
import { QuackResponseDto } from './dto/quack.response.dto';
import { VoteDto } from './dto/vote.dto';
import { FeedScopePipe } from './feed-scope.pipe';
import { SearchQueryPipe } from './search-query.pipe';

@ApiTags('quacks')
@Controller('quacks')
@UseGuards(AuthenticatedUserGuard)
@ApiCookieAuth()
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class QuacksController {
  constructor(private readonly quacksService: QuacksService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'List quacks, optionally searching text or author' })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 100 })
  @ApiQuery({ name: 'scope', required: false, enum: ['all', 'mine'] })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    @User() user: Identity,
    // A union prevents the controller-wide pipe from coercing repeated q values
    // to a string before SearchQueryPipe can reject their array shape.
    @Query('q', SearchQueryPipe) search?: string | null,
    @Query('scope', FeedScopePipe) scope?: 'all' | 'mine' | null,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(
      search ?? undefined,
      user.id,
      scope ?? 'all',
    );
    return quacks.map((q) => QuackResponseDto.fromDomain(q, user));
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  async get(
    @Param('id') id: string,
    @User() user: Identity,
  ): Promise<QuackResponseDto> {
    return QuackResponseDto.fromDomain(
      await this.quacksService.getQuack(id, user),
      user,
    );
  }

  @Get(':id/replies')
  @Header('Cache-Control', 'private, no-store')
  async replies(
    @Param('id') id: string,
    @User() user: Identity,
    @Query('cursor') cursor?: string | null,
  ): Promise<{ items: QuackResponseDto[]; nextCursor: string | null }> {
    if (
      cursor !== undefined &&
      cursor !== null &&
      (typeof cursor !== 'string' || cursor.length > 128 || !cursor)
    )
      throw new BadRequestException('Invalid reply cursor.');
    const page = await this.quacksService.getReplies(
      id,
      user,
      cursor ?? undefined,
    );
    return {
      ...page,
      items: page.items.map((q) => QuackResponseDto.fromDomain(q, user)),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a quack' })
  @ApiResponse({ status: 201, type: QuackResponseDto })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async create(
    @User() user: Identity,
    @Body() body: CreateQuackDto,
  ): Promise<QuackResponseDto> {
    const quack = await this.quacksService.createQuack(user, {
      text: body.text,
      parentId: body.parentId,
      mood: body.mood,
      pollOptions: body.pollOptions,
    });
    return QuackResponseDto.fromDomain(quack, user);
  }

  @Put(':id/vote')
  @ApiOperation({ summary: 'Cast or change your vote' })
  async vote(
    @User() user: Identity,
    @Param('id') id: string,
    @Body() body: VoteDto,
  ): Promise<QuackResponseDto> {
    return QuackResponseDto.fromDomain(
      await this.quacksService.vote(user, id, body.optionId),
      user,
    );
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a quack as its author or an admin' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 403, description: 'Neither the author nor an admin' })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async delete(@User() user: Identity, @Param('id') id: string): Promise<void> {
    await this.quacksService.delete(user, id);
  }
}
