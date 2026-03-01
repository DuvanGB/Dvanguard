-- Add retry metadata to AI jobs for admin operations.
ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS retry_of_job_id uuid REFERENCES public.ai_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.ai_jobs
  ADD COLUMN IF NOT EXISTS attempt integer;

UPDATE public.ai_jobs
SET attempt = 1
WHERE attempt IS NULL;

ALTER TABLE public.ai_jobs
  ALTER COLUMN attempt SET DEFAULT 1;

ALTER TABLE public.ai_jobs
  ALTER COLUMN attempt SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created_at ON public.ai_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_retry_of_job_id ON public.ai_jobs(retry_of_job_id);
