// ============================================
// GROQ CLIENT — global FIFO queue + key rotation
// ============================================
// Business rules (PRD §4 / F-007 / F-008):
//   - One Groq call at a time, globally (in-process promise chain).
//   - Keys rotate in sortOrder; on 429: log, wait 1s, try next key (1 attempt
//     per key per cycle).
//   - All keys 429: wait 60s, retry the whole cycle once, then give up.
//   - Other errors (network, 4xx/5xx non-429): no rotation — log and fail.
//   - No admin notification on 429 (only the log rows).
// Every attempt is written to groq_logs.

import { insertGroqLogs, listGroqKeyRows } from '@/lib/groq-store';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-120b';
const ATTEMPT_TIMEOUT_MS = 30_000;
const RETRY_BETWEEN_KEYS_MS = 1_000;
const RETRY_FULL_CYCLE_MS = 60_000;
const MAX_CYCLES = 2;

export type GroqChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type GroqLogEntry = Parameters<typeof insertGroqLogs>[0][number];

// ponytail: in-process lock — one Node instance only; Redis lock if scaled
// horizontally or run serverless.
const g = globalThis as unknown as { __groq_chain__?: Promise<unknown> };

/** Enqueue fn onto the global FIFO chain; resolves in call order. */
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = g.__groq_chain__ ?? Promise.resolve();
  const next = run.then(fn, fn);
  g.__groq_chain__ = next.catch(() => undefined);
  return next;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AttemptResult = { text: string | null; allRateLimited: boolean };

async function attemptWithKey(
  apiKey: string,
  keyId: string,
  maskedKey: string,
  requestId: string,
  chatId: string,
  messages: GroqChatMessage[],
  logs: GroqLogEntry[],
): Promise<AttemptResult> {
  const startedAt = Date.now();
  try {
    console.log(GROQ_API_URL, messages, process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL);
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
        messages,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    const durationMs = Date.now() - startedAt;
    console.log(res);
    if (res.ok) {
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      logs.push({
        keyId,
        maskedKey,
        requestId,
        chatId,
        status: 'success',
        durationMs,
      });
      return { text: body.choices?.[0]?.message?.content ?? null, allRateLimited: false };
    }

    const errorText = (await res.text().catch(() => '')).slice(0, 200);
    if (res.status === 429) {
      logs.push({ keyId, maskedKey, requestId, chatId, status: '429', durationMs });
      return { text: null, allRateLimited: true };
    }
    // Other error: no rotation (PRD flowchart) — log and stop the cycle.
    logs.push({
      keyId,
      maskedKey,
      requestId,
      chatId,
      status: 'error',
      durationMs,
      errorMessage: `HTTP ${res.status}: ${errorText}`,
    });
    return { text: null, allRateLimited: false };
  } catch (error) {
    logs.push({
      keyId,
      maskedKey,
      requestId,
      chatId,
      status: 'error',
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message.slice(0, 200) : 'fetch failed',
    });
    return { text: null, allRateLimited: false };
  }
}

/**
 * Run one Groq chat completion through the global queue with key rotation.
 * Returns the assistant text, or null when no keys are configured, every
 * attempt fails, or the model returned no content.
 */
export async function callGroq(
  messages: GroqChatMessage[],
  chatId = '',
): Promise<string | null> {
  return enqueue(async () => {
    console.log('callGroq: messages.length:', messages.length, 'chatId:', chatId);
    const keys = (await listGroqKeyRows()).filter((k) => k.active);
    if (keys.length === 0) {
      console.error('No active Groq keys configured');
      return null;
    }
    console.log('callGroq: active keys:', keys.map((k) => k.maskedKey).join(', '));
    const requestId = crypto.randomUUID();
    const logs: GroqLogEntry[] = [];

    for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const result = await attemptWithKey(
          key.fullKey,
          key.id,
          key.maskedKey,
          requestId,
          chatId,
          messages,
          logs,
        );
        console.log("result:", { text: result.text, allRateLimited: result.allRateLimited, keyId: key.id, maskedKey: key.maskedKey });
        if (result.text !== null) {
          await insertGroqLogs(logs).catch(() => undefined);
          return result.text;
        }
        if (!result.allRateLimited) {
          // Non-429 failure — rotation won't help.
          await insertGroqLogs(logs).catch(() => undefined);
          return null;
        }
        // 429: wait 1s before the next key (also after the last key of a
        // cycle that will retry — the wait doubles as the inter-cycle pause
        // for the first cycle; the full 60s pause only applies between cycles).
        if (i < keys.length - 1 || cycle < MAX_CYCLES) {
          await sleep(RETRY_BETWEEN_KEYS_MS);
        }
      }
      // All keys 429'd this cycle: wait 1 minute before retrying the cycle.
      if (cycle < MAX_CYCLES) {
        await sleep(RETRY_FULL_CYCLE_MS);
      }
    }

    await insertGroqLogs(logs).catch(() => undefined);
    return null;
  });
}
