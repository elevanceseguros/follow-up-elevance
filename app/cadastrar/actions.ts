'use server';

import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';

const BRT_OFFSET_HOURS = -3;

function brtToUtc(date: string, hour = 8) {
  if (!date) return null;
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00-03:00`).toISOString();
}

function renewalReminderDate(date: string) {
  if (!date) return null;
  const d = new Date(`${date}T12:00:00-03:00`);
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

function cleanPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('55')) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function createLead(formData: FormData) {
  await requireAdmin();
  const supabaseAdmin = getSupabaseAdmin();

  const nome = String(formData.get('nome') || '').trim() || null;
  const telefone = cleanPhone(String(formData.get('telefone') || ''));
  const produto = String(formData.get('produto') || 'outro');
  const status = String(formData.get('status') || 'nao_respondeu');
  const resumo = String(formData.get('resumo') || '').trim() || null;
  const insurer = String(formData.get('insurer') || '').trim() || null;
  const policyNumber = String(formData.get('policy_number') || '').trim() || null;
  const plate = String(formData.get('vehicle_plate') || '').trim() || null;
  const renewalDate = String(formData.get('renewal_date') || '').trim() || null;
  const nextContactDate = String(formData.get('next_contact_date') || '').trim() || null;

  if (!telefone) throw new Error('Telefone obrigatório');

  const reminderAt = renewalDate ? renewalReminderDate(renewalDate) : null;
  const nextFollowupAt = status === 'cliente_ativo' && produto === 'seguro_auto' && reminderAt
    ? reminderAt
    : nextContactDate
      ? brtToUtc(nextContactDate)
      : null;

  const payload = {
    nome,
    telefone,
    produto,
    status,
    origem: 'cadastro_manual',
    resumo,
    ultima_mensagem_cliente: resumo,
    urgencia: 'media',
    insurer,
    policy_number: policyNumber,
    vehicle_plate: plate,
    renewal_date: renewalDate,
    renewal_reminder_at: reminderAt,
    next_followup_at: nextFollowupAt,
    close_reason: status === 'cliente_ativo' ? 'fechou_conosco' : status === 'finalizado' ? 'finalizado_manual' : null,
    closed_at: ['cliente_ativo','finalizado'].includes(status) ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('leads')
    .upsert(payload, { onConflict: 'telefone' })
    .select('id')
    .single();
  if (error) throw error;

  await supabaseAdmin.from('lead_events').insert({
    lead_id: data.id,
    type: 'manual_lead_created_or_updated',
    payload
  });

  redirect('/?cadastro=ok');
}
