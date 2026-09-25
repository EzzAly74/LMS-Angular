import { FullConfig, request } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Log in once as the local e2e admin and save the browser state (D-047).
 *
 * Credentials come from `.env.e2e`, which is gitignored and generated locally
 * against a dedicated `e2e@local.test` account that holds the full `view-*`
 * set. The harness therefore never uses a real person's account, and nothing
 * secret is written anywhere that is committed.
 *
 * The Dashboard keeps its bearer token in localStorage under `2b_token`
 * (see auth.service.ts). That is DB-03 - deferred to Stage H because the real
 * fix, httpOnly cookies, needs TLS - so the harness seeds localStorage the same
 * way the app does rather than pretending the storage model is different.
 */

const TOKEN_KEY = '2b_token';
const STATE_PATH = resolve(__dirname, '.auth/admin.json');

function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const out: Record<string, string> = {};

  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq > 0) {
      out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
    }
  }

  return out;
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const fileEnv = readEnvFile(resolve(__dirname, '../.env.e2e'));
  const env = (key: string): string | undefined => process.env[key] ?? fileEnv[key];

  const apiBase  = env('E2E_API_BASE') ?? 'http://127.0.0.1:8000';
  const email    = env('E2E_ADMIN_EMAIL');
  const password = env('E2E_ADMIN_PASSWORD');

  if (!email || !password) {
    throw new Error(
      'E2E credentials missing. Generate .env.e2e by provisioning the local ' +
        'e2e admin (see _audit/PROGRESS.md, D-047). The harness will not fall back ' +
        'to a real account.',
    );
  }

  const api = await request.newContext({ baseURL: apiBase });
  const res = await api.post('/api/v1/auth/admin/login', {
    data: { email, password },
    headers: { Accept: 'application/json' },
  });

  if (!res.ok()) {
    // Status only - never echo the response body, which may reflect input.
    throw new Error(`E2E login failed with HTTP ${res.status()}. Is the API running at ${apiBase}?`);
  }

  const body = (await res.json()) as { result?: { token?: string } };
  const token = body.result?.token;
  await api.dispose();

  if (!token) {
    throw new Error('E2E login succeeded but returned no token; the response shape may have changed.');
  }

  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    throw new Error('playwright.config.ts must set use.baseURL.');
  }

  mkdirSync(dirname(STATE_PATH), { recursive: true });

  writeFileSync(
    STATE_PATH,
    JSON.stringify(
      {
        cookies: [],
        origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: TOKEN_KEY, value: token }] }],
      },
      null,
      2,
    ),
  );
}
