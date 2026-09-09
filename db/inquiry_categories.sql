-- ============================================================
-- 문의 분류 룩업. ENUM 대신 테이블. 삭제는 is_active=false.
-- 실행: Supabase SQL Editor 또는 apply_migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inquiry_categories (
  slug text PRIMARY KEY,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS inquiry_categories_label_ci
  ON public.inquiry_categories (lower(btrim(label)));

INSERT INTO public.inquiry_categories (slug, label, sort_order, is_active, is_system)
VALUES
  ('bug', '버그/오류', 10, true, false),
  ('account', '계정/정지', 20, true, true),
  ('rules', '규칙/정책', 30, true, false),
  ('report_followup', '신고 처리 문의', 40, true, false),
  ('etc', '기타', 50, true, true)
ON CONFLICT (slug) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.proname = 'submit_inquiry'
      AND p.pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig;
  END LOOP;
END $$;

ALTER TABLE public.inquiries
  ALTER COLUMN category TYPE text USING category::text;

ALTER TABLE public.inquiries
  DROP CONSTRAINT IF EXISTS inquiries_category_fk;

ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_category_fk
  FOREIGN KEY (category) REFERENCES public.inquiry_categories(slug);

DROP TYPE IF EXISTS public.inquiry_category;

CREATE OR REPLACE FUNCTION public.submit_inquiry(
  p_category text,
  p_title text,
  p_body text,
  p_attachments jsonb DEFAULT '[]'::jsonb,
  p_reason_tag text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_active boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING errcode = '42501';
  END IF;
  IF length(btrim(p_title)) < 5 OR length(p_title) > 50 THEN
    RAISE EXCEPTION 'Title length invalid' USING errcode = '22023';
  END IF;
  IF length(btrim(p_body)) < 10 OR length(p_body) > 1000 THEN
    RAISE EXCEPTION 'Body length invalid' USING errcode = '22023';
  END IF;

  SELECT is_active INTO v_active
    FROM public.inquiry_categories
   WHERE slug = p_category;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown category' USING errcode = '22023';
  END IF;
  IF NOT v_active THEN
    RAISE EXCEPTION 'Category inactive' USING errcode = '22023';
  END IF;

  INSERT INTO public.inquiries (
    author_id, category, title, body, attachments, reason_tag, auto_close_at
  ) VALUES (
    v_uid, p_category, btrim(p_title), btrim(p_body),
    coalesce(p_attachments, '[]'::jsonb),
    p_reason_tag,
    now() + interval '7 days'
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_inquiry_category(p_label text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_label text := btrim(coalesce(p_label, ''));
  v_slug text;
  v_order int;
BEGIN
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  IF char_length(v_label) < 1 OR char_length(v_label) > 20 THEN
    RAISE EXCEPTION 'category_label_invalid' USING errcode = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inquiry_categories
     WHERE lower(label) = lower(v_label)
  ) THEN
    RAISE EXCEPTION 'category_label_taken' USING errcode = '23505';
  END IF;

  v_slug := 'c_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  SELECT coalesce(max(sort_order), 50) + 10 INTO v_order FROM public.inquiry_categories;

  INSERT INTO public.inquiry_categories (slug, label, sort_order, is_active, is_system)
  VALUES (v_slug, v_label, v_order, true, false);

  INSERT INTO public.admin_actions (actor_id, action_kind, target_kind, target_id, payload)
  VALUES (
    v_uid,
    'inquiry.category_create',
    'inquiry',
    v_slug,
    jsonb_build_object('slug', v_slug, 'label', v_label)
  );

  RETURN v_slug;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_inquiry_category_active(p_slug text, p_active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_system boolean;
  v_label text;
BEGIN
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden' USING errcode = '42501';
  END IF;
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'category_unknown' USING errcode = '22023';
  END IF;

  SELECT is_system, label INTO v_system, v_label
    FROM public.inquiry_categories
   WHERE slug = p_slug
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'category_unknown' USING errcode = '22023';
  END IF;
  IF v_system AND p_active IS NOT TRUE THEN
    RAISE EXCEPTION 'category_system' USING errcode = '42501';
  END IF;

  UPDATE public.inquiry_categories
     SET is_active = p_active
   WHERE slug = p_slug;

  INSERT INTO public.admin_actions (actor_id, action_kind, target_kind, target_id, payload)
  VALUES (
    v_uid,
    'inquiry.category_set_active',
    'inquiry',
    p_slug,
    jsonb_build_object('slug', p_slug, 'label', v_label, 'active', p_active)
  );
END;
$function$;

ALTER TABLE public.inquiry_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inquiry_categories_select_authenticated ON public.inquiry_categories;
CREATE POLICY inquiry_categories_select_authenticated
  ON public.inquiry_categories
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE public.inquiry_categories TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_inquiry(text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_inquiry_category(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_inquiry_category_active(text, boolean) TO authenticated;
