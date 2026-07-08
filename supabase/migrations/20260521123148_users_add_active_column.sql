ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
UPDATE public.users SET active = true WHERE active IS NULL;;
