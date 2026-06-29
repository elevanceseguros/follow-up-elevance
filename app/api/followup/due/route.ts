import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

function authorized(req: NextRequest, body?: any) {
  const received = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const allowed = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return allowed.length === 0 || (!!received && allowed.includes(received));
}

async function listDue(limit = 20) {
  const supabaseAdmin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', now)
    .order('next_followup_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  const leads = (data || []).filter((lead: any) => !['aprovou', 'nao_quer_agora'].includes(lead.status));
  return { now, leads };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!authorized(req, body)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    const { now, leads } = await listDue(Number(body.limit || 20));
    return NextResponse.json({ ok: true, now, count: leads.length, leads });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
