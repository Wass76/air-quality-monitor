import { decideDedup } from './alert-dedup.policy';

describe('decideDedup', () => {
  const cooldownMs = 5 * 60_000;

  it('suppresses when not exceeding', () => {
    const result = decideDedup({
      current: null,
      isExceeding: false,
      nowMs: 1_000_000,
      cooldownMs,
    });
    expect(result.allowPublish).toBe(false);
    expect(result.next.wasExceeding).toBe(false);
  });

  it('publishes on first crossing into critical', () => {
    const result = decideDedup({
      current: null,
      isExceeding: true,
      nowMs: 1_000_000,
      cooldownMs,
    });
    expect(result.allowPublish).toBe(true);
    expect(result.next.wasExceeding).toBe(true);
    expect(result.next.lastPublishedAtMs).toBe(1_000_000);
  });

  it('suppresses while still critical within cooldown', () => {
    const first = decideDedup({
      current: null,
      isExceeding: true,
      nowMs: 1_000_000,
      cooldownMs,
    });
    const second = decideDedup({
      current: first.next,
      isExceeding: true,
      nowMs: 1_000_000 + 60_000,
      cooldownMs,
    });
    expect(second.allowPublish).toBe(false);
    expect(second.next.lastPublishedAtMs).toBe(1_000_000);
  });

  it('publishes again after cooldown while still critical', () => {
    const first = decideDedup({
      current: null,
      isExceeding: true,
      nowMs: 1_000_000,
      cooldownMs,
    });
    const second = decideDedup({
      current: first.next,
      isExceeding: true,
      nowMs: 1_000_000 + cooldownMs,
      cooldownMs,
    });
    expect(second.allowPublish).toBe(true);
    expect(second.next.lastPublishedAtMs).toBe(1_000_000 + cooldownMs);
  });

  it('publishes again after recovery then re-crossing', () => {
    const critical = decideDedup({
      current: null,
      isExceeding: true,
      nowMs: 1_000_000,
      cooldownMs,
    });
    const healthy = decideDedup({
      current: critical.next,
      isExceeding: false,
      nowMs: 1_010_000,
      cooldownMs,
    });
    expect(healthy.allowPublish).toBe(false);
    expect(healthy.next.wasExceeding).toBe(false);

    const again = decideDedup({
      current: healthy.next,
      isExceeding: true,
      nowMs: 1_020_000,
      cooldownMs,
    });
    expect(again.allowPublish).toBe(true);
  });
});
