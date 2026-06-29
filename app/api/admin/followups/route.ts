import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsApp } from '@/lib/zapi';

const Body = z.object({
  appSecret: z.string().min(1),
  action: z.enum(['list', 'approve', 'skip', 'cold']).default('list'),
  id: z.string().uuid().optional(),
  mensagem: z.string().optional()
});

function isAuthorized(secret: string) {
  const acceptedSecrets = [process.env.APP_SECRET, process.env.N8N_WEBHOOK_SECRET].filter(Boolean);
  return acceptedSecrets.length === 0 || acceptedSecrets.includes(secret);
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
    const body = Body.parse(await req.json());
    if (!isAuthorized(body.appSecret.trim())) return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 });

    const supabaseAdmin = getSupabaseAdmin();

    if (body.action === 'list') {
      const { data, error } = await supabaseAdmin
        .from('followup_approvals')
        .select('*')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return NextResponse.json({ ok: true, approvals: data || [] });
    }

    if (!body.id) throw new Error('ID da aprovação obrigatório');

    const { data: approval, error: approvalError } = await supabaseAdmin
      .from('followup_approvals')
      .select('*')
      .eq('id', body.id)
      .maybeSingle();
    if (approvalError) throw approvalError;
    if (!approval) throw new Error('Aprovação não encontrada');

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', approval.lead_id)
      .maybeSingle();
    if (leadError) throw leadError;
    if (!lead) throw new Error('Lead não encontrado');

    if (body.action === 'approve') {
      const mensagem = (body.mensagem || approval.mensagem || '').trim();
      if (!mensagem) throw new Error('Mensagem vazia');

      const zapi = await sendWhatsApp(approval.telefone, mensagem);
      const newNextFollowupAt = nextFollowupByStatus(lead.status);

      await supabaseAdmin
        .from('followup_approvals')
        .update({ approval_status: 'sent', mensagem, sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', approval.id);

      await supabaseAdmin.from('lead_events').insert({
        lead_id: lead.id,
        type: 'followup_approved_sent',
        payload: { approval_id: approval.id, mensagem, zapi }
      });

      await supabaseAdmin
        .from('leads')
        .update({ ultima_mensagem_enviada: mensagem, next_followup_at: newNextFollowupAt, updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      return NextResponse.json({ ok: true, action: 'approve', sent: true, next_followup_at: newNextFollowupAt });
    }

    if (body.action === 'cold') {
      await supabaseAdmin
        .from('followup_approvals')
        .update({ approval_status: 'cold', updated_at: new Date().toISOString() })
        .eq('id', approval.id);

      await supabaseAdmin
        .from('leads')
        .update({ status: 'nao_quer_agora', next_followup_at: null, updated_at: new Date().toISOString() })
        .eq('id', lead.id);

      await supabaseAdmin.from('lead_events').insert({
        lead_id: lead.id,
        type: 'followup_marked_cold',
        payload: { approval_id: approval.id }
      });

      return NextResponse.json({ ok: true, action: 'cold' });
    }

    const postponedTo = nextDate(3);
    await supabaseAdmin
      .from('followup_approvals')
      .update({ approval_status: 'skipped', updated_at: new Date().toISOString() })
      .eq('id', approval.id);

    await supabaseAdmin
      .from('leads')
      .update({ next_followup_at: postponedTo, updated_at: new Date().toISOString() })
      .eq('id', lead.id);

    await supabaseAdmin.from('lead_events').insert({
      lead_id: lead.id,
      type: 'followup_skipped',
      payload: { approval_id: approval.id, postponed_to: postponedTo }
    });

    return NextResponse.json({ ok: true, action: 'skip', next_followup_at: postponedTo });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
