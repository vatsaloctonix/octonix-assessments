create extension if not exists pgcrypto;

create table if not exists public.candidate_assessments (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  admin_label text null,
  status text not null default 'in_progress',
  current_step integer null,
  answers jsonb not null default '{}'::jsonb,
  proctoring jsonb not null default '{"counts": {}, "events": []}'::jsonb,
  videos jsonb not null default '{}'::jsonb,
  ai_evaluations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz null
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_candidate_assessments_updated_at on public.candidate_assessments;
create trigger trg_candidate_assessments_updated_at
before update on public.candidate_assessments
for each row execute function public.set_updated_at();

alter table public.candidate_assessments enable row level security;

-- Migration: Add current_step column (run this if table already exists)
-- This allows tracking which step the candidate is on for resume functionality
alter table public.candidate_assessments add column if not exists current_step integer null;
