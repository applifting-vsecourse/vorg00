import { QuacksService } from '@/modules/quack/services/quacks.service';
import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
  @ApiOperation({ summary: 'List quacks, optionally searching text or author' })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 100 })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 200, type: [QuackResponseDto] })
  @ApiResponse({ status: 401, description: 'Not signed in' })
  async list(
    // A union prevents the controller-wide pipe from coercing repeated q values
    // to a string before SearchQueryPipe can reject their array shape.
    @Query('q', SearchQueryPipe) search?: string | null,
  ): Promise<QuackResponseDto[]> {
    const quacks = await this.quacksService.getQuacks(search ?? undefined);
    return quacks.map(QuackResponseDto.fromDomain);
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
      mood: body.mood,
    });
    return QuackResponseDto.fromDomain(quack);
  }
}
