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

-- Migration: Add video_behavior column for admin video evaluations
alter table public.candidate_assessments add column if not exists video_behavior jsonb not null default '{}'::jsonb;

-- Video access tokens table for one-time password-protected links
create table if not exists public.video_access_tokens (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.candidate_assessments(id) on delete cascade,
  question_index integer not null,
  storage_path text not null,
  password text not null,
  expires_at timestamptz not null,
  accessed_at timestamptz null,
  is_used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_access_tokens_expires on public.video_access_tokens(expires_at);
create index if not exists idx_video_access_tokens_assessment on public.video_access_tokens(assessment_id);

alter table public.video_access_tokens enable row level security;
