# Octonix Solutions — Candidate Assessment (Vercel-ready)

Minimal 5-step assessment with:
- Unique candidate links
- Admin dashboard (single password)
- Stored answers + code
- Video recording (camera + mic) saved to Supabase Storage
- Proctoring signals (tab switching, focus changes, copy/paste, suspected devtools)
- Optional Groq AI scoring (admin-run)

## Setup (Supabase)
1. Create a Supabase project
2. SQL Editor → run `supabase.sql`
3. Storage → create bucket `octonix-assessments` (private)
4. Project Settings → API:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

## Setup (Groq, optional)
- `GROQ_API_KEY`
- `GROQ_MODEL` default: `llama-3.3-70b-versatile`
- Endpoint (OpenAI compatible): `https://api.groq.com/openai/v1/chat/completions`

## Deploy (Vercel)
Env vars:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` (optional; default `octonix-assessments`)
- `ADMIN_PASSWORD`
- `GROQ_API_KEY` (optional)
- `GROQ_MODEL` (optional)

Admin: `/admin/login`
