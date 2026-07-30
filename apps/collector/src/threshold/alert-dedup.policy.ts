/**
 * Pure dedup policy — no I/O.
 * Used inside the outbox transaction and unit-tested in isolation.
 */
export interface DedupStateSnapshot {
  wasExceeding: boolean;
  lastPublishedAtMs: number;
}

export interface DedupDecision {
  allowPublish: boolean;
  next: DedupStateSnapshot;
}

export function decideDedup(params: {
  current: DedupStateSnapshot | null;
  isExceeding: boolean;
  nowMs: number;
  cooldownMs: number;
}): DedupDecision {
  const { current, isExceeding, nowMs, cooldownMs } = params;

  if (!isExceeding) {
    return {
      allowPublish: false,
      next: {
        wasExceeding: false,
        lastPublishedAtMs: current?.lastPublishedAtMs ?? 0,
      },
    };
  }

  const wasExceeding = current?.wasExceeding ?? false;
  const lastPublishedAtMs = current?.lastPublishedAtMs ?? 0;
  const crossed = !wasExceeding;
  const cooledDown = !current || nowMs - lastPublishedAtMs >= cooldownMs;
  const allowPublish = crossed || cooledDown;

  return {
    allowPublish,
    next: {
      wasExceeding: true,
      lastPublishedAtMs: allowPublish ? nowMs : lastPublishedAtMs,
    },
  };
}
