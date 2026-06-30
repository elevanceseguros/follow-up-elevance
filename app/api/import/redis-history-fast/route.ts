import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Msg = { role?: string; content?: string };

function auth(req: NextRequest, body: any) {
  const sent = req.headers.get('x-elevance-secret') || body?.appSecret;
  const allowed = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return allowed.length === 0 || allowed.includes(sent);
}

function redisEnv() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash não configurado na Vercel');
  return { url: url.startsWith('http') ? url : `https://${url}`, token };
}

async function redis(cmd: any[]) {
  const cfg = redisEnv();
  const r = await fetch(cfg.url.replace(/\/$/, ''), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(cmd),
    cache: 'no-store'
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.error) throw new Error(j?.error || `Erro Upstash ${r.status}`);
  return j?.result;
}

async function scan(pattern: string, limit: number) {
  let cursor = '0';
  const keys: string[] = [];
  do {
    const out = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100]);
    cursor = String(out?.[0] || '0');
    for (const k of out?.[1] || []) {
      keys.push(String(k));
      if (keys.length >= limit) return keys;
    }
  } while (cursor !== '0');
  return keys;
}

function parse(raw: any): Msg[] {
  let v = raw;
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
  if (v && typeof v === 'object' && 'value' in v) {
    v = v.value;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { return []; } }
  }
  return Array.isArray(v) ? v.filter((x:any) => x?.content) : [];
}

function phone(key: string) { return key.replace(/_historico$/, '').replace(/\D/g, ''); }
function text(msgs: Msg[]) { return msgs.map(m => m.content || '').join(' ').toLowerCase(); }
function produto(t: string) {
  if (t.includes('plano') || t.includes('saúde') || t.includes('saude') || t.includes('hapvida') || t.includes('unimed') || t.includes('sagrada')) return 'plano_saude';
  if (t.includes('auto') || t.includes('carro')) return 'seguro_auto';
  if (t.includes('vida')) return 'seguro_vida';
  if (t.includes('consórcio') || t.includes('consorcio')) return 'consorcio';
  return 'outro';
}
function status(t: string) {
  if (t.includes('caro') || t.includes('valor alto')) return 'achou_caro';
  if (t.includes('vou pensar') || t.includes('pensar') || t.includes('ver com')) return 'vou_pensar';
  if (t.includes('não quero') || t.includes('nao quero') || t.includes('agora não') || t.includes('agora nao')) return 'nao_quer_agora';
  if (t.includes('fechado') || t.includes('aprov') || t.includes('vamos fazer')) return 'aprovou';
  return 'nao_respondeu';
}
function last(msgs: Msg[], role: string) { return [...msgs].reverse().find(m => m.role === role)?.content || ''; }
function firstUser(msgs: Msg[]) { return msgs.find(m => m.role === 'user')?.content || msgs[0]?.content || 'Histórico importado do WhatsApp'; }
function tomorrow() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!auth(req, body)) return NextResponse.json({ ok:false, error:'Não autorizado' }, { status: 401 });
    const pattern = body.pattern || '*_historico';
    const limit = Math.min(Number(body.limit || 50), 500);
    const dryRun = body.dryRun !== false;
    const keys = Array.isArray(body.keys) && body.keys.length ? body.keys.slice(0, limit) : await scan(pattern, limit);
    const supabase = getSupabaseAdmin();
    const results = [];

    for (const key of keys) {
      const telefone = phone(key);
      const msgs = parse(await redis(['GET', key]));
      if (!telefone || !msgs.length) { results.push({ key, ok:false }); continue; }
      const t = text(msgs);
      const lead = {
        telefone,
        nome: null,
        produto: produto(t),
        status: status(t),
        origem: 'upstash_import_fast',
        ultima_mensagem_cliente: last(msgs, 'user'),
        ultima_mensagem_enviada: last(msgs, 'assistant'),
        resumo: firstUser(msgs).slice(0, 260),
        urgencia: 'media',
        next_followup_at: tomorrow(),
        updated_at: new Date().toISOString()
      };
      if (!dryRun) {
        const saved = await supabase.from('leads').upsert(lead, { onConflict: 'telefone' }).select('id').single();
        if (saved.error) throw saved.error;
        await supabase.from('lead_events').insert({ lead_id: saved.data.id, type: 'redis_history_imported_fast', payload: { key, mensagens: msgs.length } });
      }
      results.push({ key, ok:true, telefone, produto: lead.produto, status: lead.status });
    }
    return NextResponse.json({ ok:true, dryRun, totalKeys: keys.length, imported: dryRun ? 0 : results.filter(r => r.ok).length, results });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status: 400 });
  }
}
