import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import RedisMock from 'ioredis-mock';
import { EscalationService, REDIS_CLIENT } from './escalation.service';

async function buildService(overrides?: {
  windowSeconds?: number;
  threshold?: number;
}): Promise<{ svc: EscalationService; redis: InstanceType<typeof RedisMock> }> {
  const redis = new RedisMock();

  const module = await Test.createTestingModule({
    providers: [
      EscalationService,
      { provide: REDIS_CLIENT, useValue: redis },
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, def: number) => {
            if (key === 'escalation.windowSeconds') return overrides?.windowSeconds ?? 60;
            if (key === 'escalation.threshold') return overrides?.threshold ?? 5;
            return def;
          },
        },
      },
    ],
  }).compile();

  return { svc: module.get(EscalationService), redis };
}

const EVENT_TYPE = 'temperature_high';

let testId = 0;
function freshDevice() { return `device-test-${++testId}`; }

describe('EscalationService — sliding window', () => {
  it('does NOT escalate below threshold (5 events)', async () => {
    const { svc } = await buildService();
    const device = freshDevice();
    let result = false;
    for (let i = 0; i < 5; i++) {
      result = await svc.checkAndEscalate(device, EVENT_TYPE);
    }
    expect(result).toBe(false);
  });

  it('escalates on the 6th event (threshold + 1)', async () => {
    const { svc } = await buildService();
    const device = freshDevice();
    for (let i = 0; i < 5; i++) {
      await svc.checkAndEscalate(device, EVENT_TYPE);
    }
    const result = await svc.checkAndEscalate(device, EVENT_TYPE);
    expect(result).toBe(true);
  });

  it('different event_types are independent windows', async () => {
    const { svc } = await buildService();
    const device = freshDevice();
    for (let i = 0; i < 6; i++) {
      await svc.checkAndEscalate(device, 'type_a');
    }
    const result = await svc.checkAndEscalate(device, 'type_b');
    expect(result).toBe(false);
  });

  it('different devices are independent windows', async () => {
    const { svc } = await buildService();
    const deviceA = freshDevice();
    const deviceB = freshDevice();
    for (let i = 0; i < 6; i++) {
      await svc.checkAndEscalate(deviceA, EVENT_TYPE);
    }
    const result = await svc.checkAndEscalate(deviceB, EVENT_TYPE);
    expect(result).toBe(false);
  });

  it('getWindowCount returns current count', async () => {
    const { svc } = await buildService();
    const device = freshDevice();
    for (let i = 0; i < 3; i++) {
      await svc.checkAndEscalate(device, EVENT_TYPE);
    }
    const count = await svc.getWindowCount(device, EVENT_TYPE);
    expect(count).toBe(3);
  });

  it('evicts old entries outside the window', async () => {
    const { svc, redis } = await buildService({ windowSeconds: 60 });
    const device = freshDevice();

    const key = `esc:${device}:${EVENT_TYPE}`;
    const oldTime = Math.floor(Date.now() / 1000) - 120;
    for (let i = 0; i < 5; i++) {
      await redis.zadd(key, oldTime, `old:${i}`);
    }

    const result = await svc.checkAndEscalate(device, EVENT_TYPE);
    expect(result).toBe(false);

    const count = await svc.getWindowCount(device, EVENT_TYPE);
    expect(count).toBe(1);
  });

  it('returns false on Redis failure (graceful degradation)', async () => {
    const brokenRedis = {
      pipeline: () => ({
        zadd: () => brokenRedis.pipeline(),
        zremrangebyscore: () => brokenRedis.pipeline(),
        zcard: () => brokenRedis.pipeline(),
        expire: () => brokenRedis.pipeline(),
        exec: () => { throw new Error('Redis down'); },
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: REDIS_CLIENT, useValue: brokenRedis },
        {
          provide: ConfigService,
          useValue: { get: (_: string, def: number) => def },
        },
      ],
    }).compile();

    const svc = module.get(EscalationService);
    const result = await svc.checkAndEscalate(freshDevice(), EVENT_TYPE);
    expect(result).toBe(false);
  });
});
