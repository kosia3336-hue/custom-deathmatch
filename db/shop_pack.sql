-- 상점 팩 개봉. 결제는 먼저 하고, 칸마다 서버가 두 장을 뽑아 둔 뒤 고른 쪽만 지급한다.
-- 중간에 닫으면 남은 칸은 지급하지 않는다.
-- 클라이언트는 이 테이블을 직접 읽지 않는다. service_role 만 쓴다.

CREATE TABLE IF NOT EXISTS public.shop_pack_sessions (
  id uuid PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  pack_id text NOT NULL CHECK (pack_id IN ('bronze', 'gold', 'diamond')),
  price_paid integer NOT NULL CHECK (price_paid > 0),
  slot integer NOT NULL DEFAULT 0 CHECK (slot >= 0),
  slots integer NOT NULL CHECK (slots BETWEEN 1 AND 6),
  status text NOT NULL DEFAULT 'choosing' CHECK (status IN ('choosing', 'granting', 'done')),
  current_pair jsonb,
  used jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_pack_sessions_member_idx
  ON public.shop_pack_sessions (member_id, created_at DESC);

ALTER TABLE public.shop_pack_sessions ENABLE ROW LEVEL SECURITY;
