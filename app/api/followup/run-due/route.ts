import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { classifyLead } from '@/lib/claude';
import { sendWhatsApp } from '@/lib/zapi';

const Body = z.object({
  appSecret: z.string().optional(),
  limit: z.number().optional().default(10),
  mode: z.enum(['preview', 'send']).optional().default('preview'),
  nextFollowupDays: z.number().optional().default(2)
});

function authorized(req: NextRequest, body?: any) {
  const received = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const allowed = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return allowed.length === 0 || (!!received && allowed.includes(received));
}

function nextDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => ({}));
    if (!authorized(req, raw)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });
    const body = Body.parse(raw);
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', now)
      .order('next_followup_at', { ascending: true })
      .limit(body.limit);

    if (error) throw error;
    const dueLeads = (data || []).filter((lead: any) => !['aprovou', 'nao_quer_agora'].includes(lead.status));
    const results: any[] = [];

    for (const lead of dueLeads) {
      const classification = await classifyLead({
        ...lead,
        tarefa: 'gerar uma mensagem curta de follow-up para WhatsApp, humana, consultiva, educada, vendedora sem parecer robô, sem prometer preço/cobertura/aprovação'
      });
      const mensagem = classification.mensagem_sugerida || 'Oi! Passando rapidinho para saber se ficou alguma dúvida sobre a proposta que te enviei.';
      const result: any = { leadId: lead.id, telefone: lead.telefone, nome: lead.nome, produto: lead.produto, status: lead.status, mensagem, mode: body.mode };

      if (body.mode === 'send') {
        const zapi = await sendWhatsApp(lead.telefone, mensagem);
        const next = nextDate(body.nextFollowupDays);
        await supabaseAdmin.from('lead_events').insert({ lead_id: lead.id, type: 'auto_followup_sent', payload: { mensagem, zapi, classification } });
        await supabaseAdmin.from('leads').update({ ultima_mensagem_enviada: mensagem, status: 'followup_enviado', next_followup_at: next, updated_at: new Date().toISOString() }).eq('id', lead.id);
        result.sent = true;
        result.next_followup_at = next;
        result.zapi = zapi;
      } else {
        await supabaseAdmin.from('lead_events').insert({ lead_id: lead.id, type: 'followup_preview', payload: { mensagem, classification } });
        result.sent = false;
      }

      results.push(result);
    }

    return NextResponse.json({ ok: true, mode: body.mode, now, count: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
