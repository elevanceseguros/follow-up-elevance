'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsApp } from '@/lib/zapi';
import { requireAdmin } from '@/lib/adminAuth';

const BRT_OFFSET_HOURS = -3;
const BUSINESS_START_HOUR = 8;

function nextDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function brtToUtc(year: number, month: number, day: number, hour: number, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour - BRT_OFFSET_HOURS, minute, 0, 0));
}

function nextBusinessDayAt(days: number, hour = BUSINESS_START_HOUR) {
  const now = new Date();
  const brt = new Date(now.getTime() + BRT_OFFSET_HOURS * 60 * 60 * 1000);
  let target = brtToUtc(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + days, hour, 0);
  while (true) {
    const p = new Date(target.getTime() + BRT_OFFSET_HOURS * 60 * 60 * 1000).getUTCDay();
    if (p >= 1 && p <= 5) return target.toISOString();
    target = new Date(target.getTime() + 24 * 60 * 60 * 1000);
  }
}

function nextFollowupByStatus(status: string) {
  if (status === 'achou_caro') return nextBusinessDayAt(2);
  if (status === 'vou_pensar') return nextBusinessDayAt(3);
  if (status === 'nao_quer_agora') return nextBusinessDayAt(7);
  if (status === 'nao_respondeu') return nextBusinessDayAt(2);
  return nextBusinessDayAt(3);
}

function renewalReminderDate(date: string) {
  const d = new Date(`${date}T12:00:00-03:00`);
  d.setDate(d.getDate() - 30);
  return d.toISOString();
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

async function closeApproval(supabaseAdmin: any, approvalId: string, status: string) {
  await supabaseAdmin
    .from('followup_approvals')
    .update({ approval_status: status, updated_at: new Date().toISOString() })
    .eq('id', approvalId);
}

export async function approveFollowup(formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
  const postponedTo = nextBusinessDayAt(3);

  await closeApproval(supabaseAdmin, approval.id, 'skipped');

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
  await requireAdmin();
  const id = String(formData.get('id') || '');
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);

  await closeApproval(supabaseAdmin, approval.id, 'cold');

  await supabaseAdmin
    .from('leads')
    .update({ status: 'nao_quer_agora', close_reason: 'lead_frio', next_followup_at: null, updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    type: 'followup_marked_cold',
    payload: { approval_id: approval.id }
  });

  revalidatePath('/');
}

export async function finishClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') || '');
  const reason = String(formData.get('reason') || 'finalizado');
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);

  await closeApproval(supabaseAdmin, approval.id, reason);
  await supabaseAdmin
    .from('leads')
    .update({ status: 'finalizado', close_reason: reason, closed_at: new Date().toISOString(), next_followup_at: null, updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    type: 'lead_finalizado',
    payload: { approval_id: approval.id, reason }
  });

  revalidatePath('/');
}

export async function markWonClient(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') || '');
  const product = String(formData.get('product') || '').trim();
  const renewalDate = String(formData.get('renewal_date') || '').trim();
  const insurer = String(formData.get('insurer') || '').trim();
  const policyNumber = String(formData.get('policy_number') || '').trim();
  const plate = String(formData.get('plate') || '').trim();
  if (!id) throw new Error('ID obrigatório');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
  const next_followup_at = product === 'seguro_auto' && renewalDate ? renewalReminderDate(renewalDate) : nextBusinessDayAt(1);

  await closeApproval(supabaseAdmin, approval.id, 'won');
  await supabaseAdmin
    .from('leads')
    .update({
      status: 'cliente_ativo',
      produto: product || lead.produto,
      close_reason: 'fechou_conosco',
      closed_at: new Date().toISOString(),
      renewal_date: renewalDate || null,
      renewal_reminder_at: product === 'seguro_auto' && renewalDate ? next_followup_at : null,
      policy_number: policyNumber || null,
      insurer: insurer || null,
      vehicle_plate: plate || null,
      next_followup_at,
      updated_at: new Date().toISOString()
    })
    .eq('id', lead.id);

  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    type: 'client_won',
    payload: { approval_id: approval.id, product, renewal_date: renewalDate, insurer, policy_number: policyNumber, plate, next_followup_at }
  });

  revalidatePath('/');
}

export async function scheduleRenewal(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') || '');
  const renewalDate = String(formData.get('renewal_date') || '').trim();
  const insurer = String(formData.get('insurer') || '').trim();
  const policyNumber = String(formData.get('policy_number') || '').trim();
  const plate = String(formData.get('plate') || '').trim();
  if (!id) throw new Error('ID obrigatório');
  if (!renewalDate) throw new Error('Informe a data de vencimento da apólice');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
  const reminderAt = renewalReminderDate(renewalDate);

  await closeApproval(supabaseAdmin, approval.id, 'renewal_scheduled');
  await supabaseAdmin
    .from('leads')
    .update({
      status: 'renovacao_futura',
      produto: 'seguro_auto',
      renewal_date: renewalDate,
      renewal_reminder_at: reminderAt,
      policy_number: policyNumber || null,
      insurer: insurer || null,
      vehicle_plate: plate || null,
      next_followup_at: reminderAt,
      updated_at: new Date().toISOString()
    })
    .eq('id', lead.id);

  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    type: 'renewal_scheduled',
    payload: { approval_id: approval.id, renewal_date: renewalDate, reminder_at: reminderAt, insurer, policy_number: policyNumber, plate }
  });

  revalidatePath('/');
}

export async function sendPostSale(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') || '');
  const mensagem = String(formData.get('mensagem_pos_venda') || '').trim();
  if (!id) throw new Error('ID obrigatório');
  if (!mensagem) throw new Error('Mensagem vazia');

  const { supabaseAdmin, approval, lead } = await getApprovalAndLead(id);
  const zapi = await sendWhatsApp(approval.telefone, mensagem);

  await closeApproval(supabaseAdmin, approval.id, 'post_sale_sent');
  await supabaseAdmin
    .from('leads')
    .update({ status: 'cliente_ativo', ultima_mensagem_enviada: mensagem, next_followup_at: nextBusinessDayAt(7), updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  await supabaseAdmin.from('lead_events').insert({
    lead_id: lead.id,
    type: 'post_sale_sent',
    payload: { approval_id: approval.id, mensagem, zapi }
  });

  revalidatePath('/');
}
