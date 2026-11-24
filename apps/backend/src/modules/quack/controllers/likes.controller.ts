import { AuthenticatedUserGuard } from '@/shared/auth/guards/authenticated-user.guard';
import { Controller, Delete, Put, UseGuards } from '@nestjs/common';

@Controller('quacks/:quackId/like')
@UseGuards(AuthenticatedUserGuard)
export class LikesController {
  @Put()
  like(): never {
    throw new Error('not implemented');
  }

  @Delete()
  unlike(): never {
    throw new Error('not implemented');
  }
}
