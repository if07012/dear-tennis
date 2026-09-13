// ============================================
// WAHA CLIENT — outbound messages + LID → phone-number resolution
// ============================================
// Thin REST wrapper over WAHA's API. Never throws to the caller: WAHA being
// down must not break admin actions or the webhook — failures are logged
// and reported via the return value.

import https from 'node:https';

export function isWahaConfigured(): boolean {
  return Boolean(process.env.WAHA_BASE_URL?.trim());
}

// WAHA dev setups often serve a self-signed cert, which global fetch rejects
// (DEPTH_ZERO_SELF_SIGNED_CERT). WAHA_INSECURE_TLS=1 switches this module to
// a stdlib https request that accepts it — scoped to WAHA only, Supabase and
// Groq keep full certificate validation. DEV ONLY.
const insecureTls = process.env.WAHA_INSECURE_TLS === '1';

function sessionName(): string {
  return process.env.WAHA_SESSION?.trim() || 'default';
}

type WahaResponse = { ok: boolean; json: Record<string, unknown> | null };

/**
 * Shared WAHA REST call: base URL, API-key headers, self-signed-cert
 * tolerance. Never throws — failures resolve to { ok: false }.
 */
async function wahaRequest(
  path: string,
  init?: { method?: 'GET' | 'POST'; body?: string },
): Promise<WahaResponse> {
  const base = process.env.WAHA_BASE_URL?.trim();
  if (!base) return { ok: false, json: null };

  const url = new URL(path, `${base.replace(/\/$/, '')}/`);
  const apiKey = process.env.WAHA_API_KEY?.trim();
  // WAHA accepts its API key either way; send both so either config works.
  const authHeaders: Record<string, string> = apiKey
    ? { 'x-api-key': apiKey, authorization: `Bearer ${apiKey}` }
    : {};
  const headers: Record<string, string> = { ...authHeaders };
  const body = init?.body;
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(Buffer.byteLength(body));
  }
  const method = init?.method ?? 'GET';

  try {
    if (insecureTls && url.protocol === 'https:') {
      return await new Promise<WahaResponse>((resolve) => {
        const req = https.request(
          {
            hostname: url.hostname,
            port: url.port || 443,
            path: `${url.pathname}${url.search}`,
            method,
            headers,
            agent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 10_000,
          },
          (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              raw += chunk;
            });
            res.on('end', () => {
              const ok =
                res.statusCode !== undefined &&
                res.statusCode >= 200 &&
                res.statusCode < 300;
              let json: Record<string, unknown> | null = null;
              try {
                json = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
              } catch {
                json = null;
              }
              resolve({ ok, json });
            });
          },
        );
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', (err) => {
          console.error('WAHA request error:', err);
          resolve({ ok: false, json: null });
        });
        req.end(body ?? '');
      });
    }

    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`WAHA ${path} failed: HTTP ${res.status}`);
      return { ok: false, json: null };
    }
    const json = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    return { ok: true, json };
  } catch (error) {
    console.error(`WAHA ${path} error:`, error);
    return { ok: false, json: null };
  }
}

/**
 * Send a text message to a WhatsApp chat via WAHA.
 * Returns true when WAHA accepted it; false (never throws) otherwise.
 */
export async function sendWahaText(chatId: string, text: string): Promise<boolean> {
  if (!chatId || !text) return false;
  const { ok } = await wahaRequest('api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: sessionName(), chatId, text }),
  });
  return ok;
}

/**
 * Resolve a webhook "from" chat id to the phone-number chat id. WhatsApp
 * increasingly identifies chats by LID ("…@lid"); member identity matching
 * (users.waChatId, users.phone) needs the pn ("62812…@c.us"). Uses
 * GET /api/{session}/lids/{lid}. Returns the input unchanged when it is
 * already a pn chat id, or when the lookup fails (pn is null for numbers
 * not in the session's contact list) — sending to the LID still works.
 */
export async function resolveWahaChatId(from: string): Promise<string> {
  const chatId = from.trim();
  if (!chatId || !chatId.endsWith('@lid')) return chatId;
  const { json } = await wahaRequest(
    `api/${sessionName()}/lids/${encodeURIComponent(chatId)}`,
  );
  const pn = String((json as { pn?: unknown } | null)?.pn ?? '').trim();
  return pn || chatId;
}
