'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsApp } from '@/lib/zapi';

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

async function getApprovalAndLead(id: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: approval, error: approvalError } = await supabaseAdmin
    .from('followup_approvals')
    .select('*')
    .eq('id', id)
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

  return { supabaseAdmin, approval, lead };
}

export async function approveFollowup(formData: FormData) {
  const id = String(formData.get('id') || '');
  const mensagem = String(formData.get('mensagem') || '').trim();
  if (!id) throw new Error('ID obrigatório');
  if (!mensagem) throw new Error('Mensagem vazia');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
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

  revalidatePath('/');
}

export async function skipFollowup(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
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

  revalidatePath('/');
}

export async function markColdFollowup(formData: FormData) {
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);

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

  revalidatePath('/');
}
