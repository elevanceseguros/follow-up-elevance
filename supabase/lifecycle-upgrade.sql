alter table leads
add column if not exists closed_at timestamptz,
add column if not exists close_reason text,
add column if not exists renewal_date date,
add column if not exists renewal_reminder_at timestamptz,
add column if not exists policy_number text,
add column if not exists insurer text,
add column if not exists vehicle_plate text,
add column if not exists lifecycle_notes text;

create index if not exists idx_leads_close_reason on leads(close_reason);
create index if not exists idx_leads_renewal_date on leads(renewal_date);
create index if not exists idx_leads_renewal_reminder_at on leads(renewal_reminder_at);

update leads
set next_followup_at = null,
    updated_at = now()
where status in ('finalizado','cliente_ativo')
  and next_followup_at is not null;
