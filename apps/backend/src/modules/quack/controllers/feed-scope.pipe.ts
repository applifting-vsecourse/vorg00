import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class FeedScopePipe implements PipeTransform<unknown, 'all' | 'mine'> {
  transform(value: unknown): 'all' | 'mine' {
    if (value === undefined || value === 'all') return 'all';
    if (value === 'mine') return 'mine';
    throw new BadRequestException('Feed scope must be all or mine');
  }
}
