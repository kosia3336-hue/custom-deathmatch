-- 플레이 모드 tutorial + games.supports_tutorial
-- 기본 false. 사중력 사목(game-001)만 켠다.
-- ADD VALUE 와 UPDATE 는 트랜잭션을 나누는 것이 안전하다.

ALTER TYPE public.play_mode ADD VALUE IF NOT EXISTS 'tutorial';

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS supports_tutorial boolean NOT NULL DEFAULT false;

UPDATE public.games
   SET supports_tutorial = (id = 'game-001');
