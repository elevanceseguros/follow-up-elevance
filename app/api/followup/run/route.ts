import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { classifyLead } from '@/lib/claude';
import { sendWhatsApp } from '@/lib/zapi';

const Body = z.object({
  appSecret: z.string().optional().nullable(),
  send: z.boolean().default(false),
  limit: z.number().int().min(1).max(20).default(5)
});

function isAuthorized(req: NextRequest, body?: any) {
  const receivedSecret = req.headers.get('x-elevance-secret')?.trim() || body?.appSecret?.trim();
  const acceptedSecrets = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return acceptedSecrets.length === 0 || (!!receivedSecret && acceptedSecrets.includes(receivedSecret));
}

function nextDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function nextFollowupByStatus(status: string) {
  if (status === 'achou_caro') return nextDate(2);
  if (status === 'vou_pensar') return nextDate(3);
  if (status === 'nao_quer_agora') return nextDate(7);
  if (status === 'nao_respondeu') return nextDate(2);
  return nextDate(3);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    if (!isAuthorized(req, rawBody)) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });

    const body = Body.parse(rawBody);
    const supabaseAdmin = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: leads, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', now)
      .not('status', 'in', '(aprovou,duvida,pediu_alteracao)')
      .order('next_followup_at', { ascending: true })
      .limit(body.limit);

    if (error) throw error;

    const results = [];
    for (const lead of leads || []) {
      const classification = await classifyLead({
        tarefa: 'gerar mensagem curta de follow-up para WhatsApp, humana, vendedora, sem parecer robô, sem prometer cobertura/preço/aprovação',
        lead
      });

      const mensagem = classification.mensagem_sugerida || 'Oi! Passando rapidinho para saber se ficou alguma dúvida sobre a proposta que te enviei.';
      let zapi = null;
      let sent = false;

      const newNextFollowupAt = nextFollowupByStatus(lead.status);

      if (body.send) {
        zapi = await sendWhatsApp(lead.telefone, mensagem);
        sent = true;
      } else {
        const { data: existingPending } = await supabaseAdmin
          .from('followup_approvals')
          .select('id')
          .eq('lead_id', lead.id)
          .eq('approval_status', 'pending')
          .maybeSingle();

        if (existingPending?.id) {
          await supabaseAdmin
            .from('followup_approvals')
            .update({
              nome: lead.nome,
              telefone: lead.telefone,
              produto: lead.produto,
              lead_status: lead.status,
              mensagem,
              ai_payload: classification,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPending.id);
        } else {
          await supabaseAdmin.from('followup_approvals').insert({
            lead_id: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            produto: lead.produto,
            lead_status: lead.status,
            mensagem,
            ai_payload: classification,
            approval_status: 'pending'
          });
        }
      }

      await supabaseAdmin.from('lead_events').insert({
        lead_id: lead.id,
        type: body.send ? 'followup_sent' : 'followup_approval_created',
        payload: { mensagem, classification, zapi, sent }
      });

      if (body.send) {
        await supabaseAdmin
          .from('leads')
          .update({
            ultima_mensagem_enviada: mensagem,
            next_followup_at: newNextFollowupAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', lead.id);
      }

      results.push({
        leadId: lead.id,
        nome: lead.nome,
        telefone: lead.telefone,
        status: lead.status,
        produto: lead.produto,
        sent,
        approval: body.send ? null : 'pending',
        mensagem,
        next_followup_at: body.send ? newNextFollowupAt : lead.next_followup_at
      });
    }

    return NextResponse.json({ ok: true, mode: body.send ? 'send' : 'approval', count: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
