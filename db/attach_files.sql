-- ============================================================
-- 첨부 파일 (문의/신고 스크린샷) — Supabase SQL Editor 에서 실행
--
--  업로드 시 target 없이 행 생성 → 문의/신고 제출 성공 후 target 연결.
--  다중 첨부 지원. 조회는 (target_kind, target_id) 참조키로.
-- ============================================================

CREATE TABLE IF NOT EXISTS attach_files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  target_kind text CHECK (target_kind IN ('inquiry', 'report')),
  target_id   uuid,
  url         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attach_files_target_idx ON attach_files(target_kind, target_id);
CREATE INDEX IF NOT EXISTS attach_files_member_idx ON attach_files(member_id, created_at DESC);

-- RLS: 본인 것만 읽기 (관리자는 service_role 로 조회). 쓰기는 서버 API(service_role) 전용.
ALTER TABLE attach_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attach_files_read_own ON attach_files;
CREATE POLICY attach_files_read_own ON attach_files FOR SELECT USING (auth.uid() = member_id);
