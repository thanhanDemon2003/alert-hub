import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);
  private readonly windowSeconds: number;
  private readonly threshold: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.windowSeconds = this.config.get<number>('escalation.windowSeconds', 60);
    this.threshold = this.config.get<number>('escalation.threshold', 5);
  }

  async checkAndEscalate(deviceId: string, eventType: string): Promise<boolean> {
    try {
      return await this.slidingWindowCheck(deviceId, eventType);
    } catch (err) {
      this.logger.error(`Escalation check failed (Redis error), skipping: ${err}`);
      return false;
    }
  }

  private async slidingWindowCheck(deviceId: string, eventType: string): Promise<boolean> {
    const key = `esc:${deviceId}:${eventType}`;
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;

    const pipeline = this.redis.pipeline();
    pipeline.zadd(key, now, `${now}:${uuidv4()}`);
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zcard(key);
    pipeline.expire(key, this.windowSeconds * 2);

    const results = await pipeline.exec();

    const count = results?.[2]?.[1] as number ?? 0;

    this.logger.debug(
      `Escalation window [${deviceId}/${eventType}]: ${count} events in last ${this.windowSeconds}s`,
    );

    return count > this.threshold;
  }

  async getWindowCount(deviceId: string, eventType: string): Promise<number> {
    const key = `esc:${deviceId}:${eventType}`;
    const now = Date.now() / 1000;
    const windowStart = now - this.windowSeconds;
    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      return await this.redis.zcard(key);
    } catch {
      return -1;
    }
  }
}
