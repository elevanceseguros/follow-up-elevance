import { NextRequest, NextResponse } from 'next/server';

function isAuthorized(req: NextRequest, body?: any) {
  const receivedSecret = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const acceptedSecrets = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return acceptedSecrets.length === 0 || (!!receivedSecret && acceptedSecrets.includes(receivedSecret));
}

async function testMessages(apiKey: string, model: string) {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Responda apenas: ok' }]
      })
    });

    let details: any = null;
    try { details = await res.json(); } catch { details = null; }
    return {
      model,
      ok: res.ok,
      status: res.status,
      errorType: details?.error?.type || null,
      errorMessage: details?.error?.message || null
    };
  } catch (e: any) {
    return { model, ok: false, status: 0, errorType: 'request_failed', errorMessage: e?.message || 'Falha desconhecida' };
  }
}

export async function GET(req: NextRequest) {
  const body = Object.fromEntries(req.nextUrl.searchParams.entries());
  if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPICAPIKEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: 'Chave Anthropic ausente', env: { ANTHROPIC_API_KEY: false, ANTHROPICAPIKEY: false } });

  const envModel = process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL;
  const models = Array.from(new Set([
    envModel,
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-sonnet-4-20250514',
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-haiku-20240307'
  ].filter(Boolean))) as string[];

  const tests = [];
  for (const model of models) tests.push(await testMessages(apiKey, model));

  return NextResponse.json({
    ok: true,
    env: {
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
      ANTHROPICAPIKEY: !!process.env.ANTHROPICAPIKEY,
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || null,
      CLAUDE_MODEL: process.env.CLAUDE_MODEL || null
    },
    tests
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!isAuthorized(req, body)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
  const url = new URL(req.url);
  if (body.appSecret) url.searchParams.set('appSecret', body.appSecret);
  const fakeReq = new NextRequest(url, { headers: req.headers });
  return GET(fakeReq);
}
