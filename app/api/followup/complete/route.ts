import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({
  appSecret: z.string().optional(),
  leadId: z.string().min(8),
  mensagem: z.string().optional().default(''),
  status: z.string().optional().default('followup_enviado'),
  nextFollowupDays: z.number().optional().default(2)
});

function authorized(req: NextRequest, body?: any) {
  const received = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const allowed = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return allowed.length === 0 || (!!received && allowed.includes(received));
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));
    if (!authorized(req, raw)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    const body = Body.parse(raw);
    const supabaseAdmin = getSupabaseAdmin();
    const next = new Date();
    next.setDate(next.getDate() + body.nextFollowupDays);

    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({
        status: body.status,
        ultima_mensagem_enviada: body.mensagem || undefined,
        next_followup_at: next.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', body.leadId)
      .select()
      .single();

    if (error) throw error;
    await supabaseAdmin.from('lead_events').insert({ lead_id: body.leadId, type: 'followup_completed', payload: { mensagem: body.mensagem, status: body.status, next_followup_at: next.toISOString() } });
    return NextResponse.json({ ok: true, lead: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
