import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

type Msg = { role?: string; content?: string };

const BRT_OFFSET_HOURS = -3;
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;
const FOLLOWUP_SPACING_MINUTES = 2;

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

function brtParts(date = new Date()) {
  const brt = new Date(date.getTime() + BRT_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: brt.getUTCFullYear(),
    month: brt.getUTCMonth(),
    day: brt.getUTCDate(),
    weekday: brt.getUTCDay(),
    hour: brt.getUTCHours(),
    minute: brt.getUTCMinutes()
  };
}

function brtToUtc(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour - BRT_OFFSET_HOURS, minute, 0, 0));
}

function nextBusinessStart(from = new Date()) {
  const p = brtParts(from);
  let base = brtToUtc(p.year, p.month, p.day, BUSINESS_START_HOUR, 0);
  const isWeekend = p.weekday === 0 || p.weekday === 6;

  if (!isWeekend && p.hour >= BUSINESS_START_HOUR && p.hour < BUSINESS_END_HOUR) {
    base = new Date(from.getTime() + FOLLOWUP_SPACING_MINUTES * 60 * 1000);
  } else if (!isWeekend && p.hour < BUSINESS_START_HOUR) {
    base = brtToUtc(p.year, p.month, p.day, BUSINESS_START_HOUR, 0);
  } else {
    base = brtToUtc(p.year, p.month, p.day + 1, BUSINESS_START_HOUR, 0);
  }

  while (true) {
    const bp = brtParts(base);
    if (bp.weekday >= 1 && bp.weekday <= 5 && bp.hour >= BUSINESS_START_HOUR && bp.hour < BUSINESS_END_HOUR) return base;
    base = brtToUtc(bp.year, bp.month, bp.day + 1, BUSINESS_START_HOUR, 0);
  }
}

function addBusinessMinutes(start: Date, minutesToAdd: number) {
  let d = new Date(start);
  let remaining = minutesToAdd;

  while (remaining > 0) {
    const p = brtParts(d);
    const endToday = brtToUtc(p.year, p.month, p.day, BUSINESS_END_HOUR, 0);
    const available = Math.max(0, Math.floor((endToday.getTime() - d.getTime()) / 60000));

    if (available >= remaining) return new Date(d.getTime() + remaining * 60000);

    remaining -= available;
    d = brtToUtc(p.year, p.month, p.day + 1, BUSINESS_START_HOUR, 0);
    d = nextBusinessStart(d);
  }

  return d;
}

function scheduledFollowup(index: number) {
  const base = nextBusinessStart(new Date());
  return addBusinessMinutes(base, index * FOLLOWUP_SPACING_MINUTES).toISOString();
}

function isValidLeadKey(key: string) {
  if (key.includes('-group') || key.includes('-broadcast') || key.includes('@lid')) return false;
  const base = key.replace(/_historico$/, '');
  return /^55\d{10,11}$/.test(base);
}

async function scan(pattern: string, limit: number) {
  let cursor = '0';
  const keys: string[] = [];
  do {
    const out = await redis(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100]);
    cursor = String(out?.[0] || '0');
    for (const k of out?.[1] || []) {
      const key = String(k);
      if (!isValidLeadKey(key)) continue;
      keys.push(key);
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
  if (t.includes('auto') || t.includes('carro') || t.includes('apólice') || t.includes('apolice')) return 'seguro_auto';
  if (t.includes('vida')) return 'seguro_vida';
  if (t.includes('consórcio') || t.includes('consorcio')) return 'consorcio';
  return 'outro';
}
function status(t: string) {
  if (t.includes('fechei em outro') || t.includes('fechou em outro') || t.includes('contratei em outro') || t.includes('já fechei em outro') || t.includes('ja fechei em outro')) return 'finalizado';
  if (t.includes('não quero') || t.includes('nao quero') || t.includes('não tenho interesse') || t.includes('nao tenho interesse') || t.includes('agora não') || t.includes('agora nao')) return 'finalizado';
  if (t.includes('fechado') || t.includes('aprovado') || t.includes('pode fazer') || t.includes('vamos fazer') || t.includes('vou fechar') || t.includes('contratado')) return 'cliente_ativo';
  if (t.includes('caro') || t.includes('valor alto')) return 'achou_caro';
  if (t.includes('vou pensar') || t.includes('pensar') || t.includes('ver com')) return 'vou_pensar';
  return 'nao_respondeu';
}
function closeReason(t: string) {
  if (t.includes('fechei em outro') || t.includes('fechou em outro') || t.includes('contratei em outro') || t.includes('já fechei em outro') || t.includes('ja fechei em outro')) return 'perdido_fechou_outro_lugar';
  if (t.includes('não quero') || t.includes('nao quero') || t.includes('não tenho interesse') || t.includes('nao tenho interesse') || t.includes('agora não') || t.includes('agora nao')) return 'nao_tem_interesse';
  if (t.includes('fechado') || t.includes('aprovado') || t.includes('pode fazer') || t.includes('vamos fazer') || t.includes('vou fechar') || t.includes('contratado')) return 'fechou_conosco';
  return null;
}
function last(msgs: Msg[], role: string) { return [...msgs].reverse().find(m => m.role === role)?.content || ''; }
function firstUser(msgs: Msg[]) { return msgs.find(m => m.role === 'user')?.content || msgs[0]?.content || 'Histórico importado do WhatsApp'; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!auth(req, body)) return NextResponse.json({ ok:false, error:'Não autorizado' }, { status: 401 });
    const pattern = body.pattern || '*_historico';
    const limit = Math.min(Number(body.limit || 50), 500);
    const dryRun = body.dryRun !== false;
    const rawKeys = Array.isArray(body.keys) && body.keys.length ? body.keys.slice(0, limit) : await scan(pattern, limit);
    const keys = rawKeys.filter((key: string) => isValidLeadKey(String(key)));
    const supabase = getSupabaseAdmin();
    const results = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const telefone = phone(key);
      const msgs = parse(await redis(['GET', key]));
      if (!telefone || !msgs.length) { results.push({ key, ok:false }); continue; }
      const t = text(msgs);
      const leadStatus = status(t);
      const reason = closeReason(t);
      const next_followup_at = ['finalizado','cliente_ativo'].includes(leadStatus) ? null : scheduledFollowup(i);
      const lead = {
        telefone,
        nome: null,
        produto: produto(t),
        status: leadStatus,
        origem: 'upstash_import_fast',
        ultima_mensagem_cliente: last(msgs, 'user'),
        ultima_mensagem_enviada: last(msgs, 'assistant'),
        resumo: firstUser(msgs).slice(0, 260),
        urgencia: 'media',
        close_reason: reason,
        closed_at: reason ? new Date().toISOString() : null,
        next_followup_at,
        updated_at: new Date().toISOString()
      };
      if (!dryRun) {
        const saved = await supabase.from('leads').upsert(lead, { onConflict: 'telefone' }).select('id').single();
        if (saved.error) throw saved.error;
        await supabase.from('lead_events').insert({ lead_id: saved.data.id, type: 'redis_history_imported_fast', payload: { key, mensagens: msgs.length, next_followup_at, close_reason: reason } });
      }
      results.push({ key, ok:true, telefone, produto: lead.produto, status: lead.status, close_reason: reason, next_followup_at });
    }
    return NextResponse.json({ ok:true, dryRun, totalKeys: keys.length, imported: dryRun ? 0 : results.filter(r => r.ok).length, results });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status: 400 });
  }
}
