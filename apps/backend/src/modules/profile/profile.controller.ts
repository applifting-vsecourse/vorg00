import { User } from '@/shared/auth/decorators/user.decorator';
import { Identity } from '@/shared/auth/domain/identity';
import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiCookieAuth()
@Controller('profile')
@UseGuards(AuthenticatedUserGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  get(@User() user: Identity): ReturnType<ProfileService['get']> {
    return this.profiles.get(user.id);
  }

  @Put()
  update(
    @User() user: Identity,
    @Body() input: UpdateProfileDto,
  ): ReturnType<ProfileService['update']> {
    return this.profiles.update(user.id, input);
  }
}
