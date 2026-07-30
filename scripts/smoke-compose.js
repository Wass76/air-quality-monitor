const processorBase =
  process.env.PROCESSOR_BASE ?? 'http://127.0.0.1:3002';
const healthTimeoutMs = Number(process.env.HEALTH_TIMEOUT_MS ?? 90_000);
const alertsTimeoutMs = Number(process.env.ALERTS_TIMEOUT_MS ?? 180_000);
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS ?? 5_000);

function log(message) {
  console.log(`${new Date().toISOString().slice(11, 19)} ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealthy(path) {
  const url = `${processorBase}${path}`;
  const deadline = Date.now() + healthTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        log(`OK ${url}`);
        return;
      }
    } catch {
      // The service may still be starting.
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`Timed out waiting for ${url} (${healthTimeoutMs}ms)`);
}

async function waitForAlerts() {
  const url = `${processorBase}/alerts`;
  const deadline = Date.now() + alertsTimeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const alerts = await response.json();
        if (Array.isArray(alerts) && alerts.length > 0) {
          log(`OK ${url} returned ${alerts.length} alert(s)`);
          return;
        }
        log(`Waiting for alerts; received ${JSON.stringify(alerts).slice(0, 120)}`);
      }
    } catch {
      log(`Waiting for alerts; ${url} is not reachable yet`);
    }
    await sleep(pollIntervalMs);
  }

  throw new Error(`No alerts at ${url} within ${alertsTimeoutMs}ms`);
}

async function main() {
  log(`Smoke against ${processorBase}`);
  await waitForHealthy('/health/live');
  await waitForHealthy('/health/ready');
  await waitForAlerts();
  log('Smoke passed');
}

main().catch((error) => {
  console.error(`Smoke failed: ${error.message}`);
  process.exitCode = 1;
});
