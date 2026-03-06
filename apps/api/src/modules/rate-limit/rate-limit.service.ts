import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  assertWithinLimit(key: string, max: number, windowMs: number): void {
    const now = Date.now();
    const current = this.buckets.get(key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }

    if (current.count >= max) {
      throw new HttpException("Rate limit exceeded", HttpStatus.TOO_MANY_REQUESTS);
    }

    current.count += 1;
    this.buckets.set(key, current);
  }
}
