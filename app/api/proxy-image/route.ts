// ============================================
// /api/proxy-image — public image fetch
// ============================================
//
// GET ?url=... → streams the bytes of a remote image back to the client.
// Used by the profile photo editor's "URL" tab so that <canvas> can load
// the bytes without tripping on CORS / mixed-content. Same-origin only.

import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB cap on the source image

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target || !/^https?:\/\//i.test(target)) {
    return badRequest('url must be an http(s) URL');
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { redirect: 'follow' });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to fetch' },
      { status: 502 },
    );
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }
  const contentType = upstream.headers.get('content-type') ?? '';
  if (!ALLOWED_TYPES.has(contentType.split(';')[0].toLowerCase())) {
    return badRequest('Unsupported image type');
  }
  const contentLength = Number(upstream.headers.get('content-length') ?? '0');
  if (contentLength && contentLength > MAX_BYTES) {
    return badRequest('Image too large');
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return badRequest('Image too large');
  }
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'content-type': contentType,
      'cache-control': 'no-store',
    },
  });
}
