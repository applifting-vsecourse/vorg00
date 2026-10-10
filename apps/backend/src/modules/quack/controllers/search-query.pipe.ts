import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** Validate only q: unrelated query parameters retain their existing behavior. */
@Injectable()
export class SearchQueryPipe implements PipeTransform<
  unknown,
  string | undefined
> {
  transform(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      throw new BadRequestException('Search must be a single text value');
    }
    const search = value.trim();
    if (search.length > 100) {
      throw new BadRequestException('Search must be at most 100 characters');
    }
    return search === '' ? undefined : search;
  }
}
