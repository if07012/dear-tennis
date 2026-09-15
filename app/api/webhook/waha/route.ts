// ============================================
// /api/webhook/waha — WAHA event webhook
// ============================================
// WAHA posts every session event here. We only care about incoming text
// messages (event "message", fromMe false). Auth is a shared secret in the
// x-waha-secret header — if unset, the endpoint stays closed (503) so it can
// never act as an open LLM relay.
//
// Respond 200 immediately and process fire-and-forget: the Groq retry cycle
// can wait 60s+, far beyond any webhook timeout.
// ponytail: fire-and-forget assumes a long-lived Node server (self-hosted /
// container), not a serverless platform that freezes after the response.

import { NextResponse } from 'next/server';
import { handleIncomingMessage, handleIncomingMedia } from '@/lib/whatsapp-bot';
import { fetchWahaFile, resolveWahaChatId } from '@/lib/waha-client';

// Same limits as the website proof upload (payment route).
const MAX_MEDIA_BYTES = 2 * 1024 * 1024;
const ALLOWED_MEDIA = (mime: string) =>
  mime.startsWith('image/') || mime === 'application/pdf';

export async function POST(request: Request) {
  const secret = process.env.WAHA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }
  const provided = request.headers.get('x-waha-secret') ?? '';
  // Timing-safe compare: hash both so the lengths match.
  const a = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(provided)));
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a[i] ^ b[i];
  }
  if (mismatch !== 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      from?: string;
      body?: string;
      fromMe?: boolean;
      hasMedia?: boolean;
      media?: { mimetype?: string; url?: string };
    };
  };
  try {
    event = (await request.json()) as typeof event;
  } catch {
    return NextResponse.json({ ok: true }); // malformed body — still ack
  }

  if (event.event === 'message' && event.payload && event.payload.fromMe !== true) {
    const from = String(event.payload.from ?? '').trim();
    if (from) {
      // payload.from is often a LID ("…@lid"); member matching needs the
      // phone-number chat id. Resolve before handing off, still ack-fast.
      if (event.payload.hasMedia && event.payload.media?.url) {
        // Media message: download (image/PDF only, size-capped) and stash
        // as a pending payment proof for this chat.
        void resolveWahaChatId(from)
          .then(async (chatId) => {
            const file = await fetchWahaFile(event.payload!.media!.url!);
            if (!file || !ALLOWED_MEDIA(file.mimetype)) return;
            const bytes = Math.ceil((file.base64.length * 3) / 4);
            if (bytes > MAX_MEDIA_BYTES) return;
            handleIncomingMedia(chatId, file.mimetype, file.base64);
          })
          .catch(() => undefined);
      } else {
        const body = String(event.payload.body ?? '').trim();
        if (body) {
          void resolveWahaChatId(from)
            .then((chatId) => handleIncomingMessage(chatId, body))
            .catch(() => undefined);
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
