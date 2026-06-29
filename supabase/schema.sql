create extension if not exists "uuid-ossp";

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  nome text,
  telefone text unique not null,
  produto text not null default 'outro',
  status text not null default 'novo',
  origem text,
  ultima_mensagem_cliente text,
  ultima_mensagem_enviada text,
  resumo text,
  urgencia text not null default 'media',
  next_followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_events (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_next_followup_at on leads(next_followup_at);
