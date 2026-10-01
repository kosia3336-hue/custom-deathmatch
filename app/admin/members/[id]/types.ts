import type {
  TitleColor,
  SanctionKind,
  ReportCategory,
  ReportStatus,
  InquiryStatus,
} from '@/lib/supabase/database.types';

export interface TitleData {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
}

export interface MemberTitleData {
  id: number;
  title_id: string;
  granted_at: string;
  granted_by: string | null;
  reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  title: TitleData;
  granter_nickname: string | null;
  revoker_nickname: string | null;
}

export interface NicknameHistoryData {
  id: number;
  old_nickname: string;
  new_nickname: string;
  changed_at: string;
}

export interface SanctionData {
  id: number;
  kind: SanctionKind;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  issued_by: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string;
  issuer_nickname: string | null;
}

export interface AdminActionData {
  id: number;
  actor_id: string;
  action_kind: string;
  target_kind: string;
  target_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  actor_nickname: string | null;
}

export interface GameStatData {
  game_id: string;
  game_name: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  resigns: number;
  last_played_at: string | null;
}

export interface ReportData {
  id: string;
  category: ReportCategory;
  status: ReportStatus;
  created_at: string;
  other_nickname: string;
}

export interface InquiryData {
  id: string;
  title: string;
  category: string;
  status: InquiryStatus;
  created_at: string;
  body: string;
  answer_body: string | null;
  answered_at: string | null;
  answered_by_nickname: string | null;
  category_label: string;
}
