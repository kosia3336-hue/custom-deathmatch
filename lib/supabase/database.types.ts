/**
 * Supabase DB 타입 정의 (수동 작성).
 *
 * 향후 supabase CLI 의 `supabase gen types typescript` 로 자동 생성 가능하지만,
 * v2 시작 시점에는 17_database_schema.md 기반으로 직접 정의한다.
 */

import type { RankTier } from '../../shared/types/rank';

export type { RankTier };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ──────────────────────────────────────────────
// ENUM 타입
// ──────────────────────────────────────────────

export type MemberStatus = 'active' | 'suspended' | 'banned' | 'withdrawn';
export type MemberRole = 'user' | 'admin';
export type PlayMode = 'multi' | 'com' | 'solo';
export type TurnPosition = 'first' | 'second';
import type { TitleColor } from '@shared/titles/colors';
export type { TitleColor };
export type AgreementKind = 'terms' | 'privacy' | 'marketing';
export type ReportCategory = 'abuse' | 'spam' | 'cheat' | 'bad_manner' | 'improper_nickname' | 'etc';
export type ReportStatus = 'pending' | 'processing' | 'resolved' | 'rejected';
export type ReportResolution = 'warning' | 'suspended' | 'banned' | 'rejected';
export type ReportContext = 'chat' | 'room' | 'ingame' | 'postgame' | 'profile';
export type InquiryCategory = 'bug' | 'account' | 'rules' | 'report_followup' | 'etc';
export type InquiryStatus = 'pending' | 'processing' | 'answered' | 'replied' | 'closed';
export type SanctionKind = 'warning' | 'suspension' | 'ban' | 'lift';
export type NotificationKind =
  | 'title_granted' | 'title_revoked'
  | 'report_processed' | 'inquiry_answered'
  | 'sanction_issued' | 'sanction_lifted'
  | 'misc';
export type AdminTargetKind =
  | 'member' | 'title' | 'member_title'
  | 'report' | 'inquiry' | 'agreement' | 'word' | 'notice'
  | 'rank_stats'
  | 'member_cdp' | 'shop_item' | 'shop_purchase' | 'shop_consumable';
export type BannedWordScope = 'nickname' | 'chat' | 'both';

// v2.7 (20번 문서: 공지사항)
export type NoticeCategory = 'general' | 'maintenance' | 'update' | 'event' | 'urgent';

// CDP Shop v2 — 소모성 아이템 종류
export type ConsumableKind =
  | 'nickname_change'
  | 'rank_reset'
  | 'spectator_lock'
  | 'anonymity'
  | 'magnifier'
  | 'ban_eraser';

// ──────────────────────────────────────────────
// 테이블 행 타입
// ──────────────────────────────────────────────

export interface MemberRow {
  id: string;
  nickname: string;
  displayed_title_id: string | null;
  created_at: string;
  withdrawn_at: string | null;
}

export interface MemberPrivateRow {
  member_id: string;
  role: MemberRole;
  status: MemberStatus;
  last_login_at: string | null;
  last_nickname_changed_at: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
  banned_reason: string | null;
  banned_by: string | null;
  withdrawn_reason: string | null;
  settings: Json;
  updated_at: string;
}

export interface NicknameHistoryRow {
  id: number;
  member_id: string;
  old_nickname: string;
  new_nickname: string;
  changed_at: string;
}

export interface AgreementVersionRow {
  id: number;
  kind: AgreementKind;
  version: number;
  body: string;
  is_active: boolean;
  published_at: string;
  published_by: string | null;
}

export interface MemberAgreementRow {
  id: number;
  member_id: string;
  kind: AgreementKind;
  version: number;
  agreed_at: string;
}

export interface TitleRow {
  id: string;
  name: string;
  color: TitleColor;
  description: string | null;
  condition_text: string | null;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface MemberTitleRow {
  id: number;
  member_id: string;
  title_id: string;
  granted_at: string;
  granted_by: string | null;
  reason: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
}

export interface GameLogRow {
  id: string;
  game_id: string;
  mode: PlayMode;
  room_snapshot: Json;
  result: Json;
  play_time_seconds: number;
  total_turns: number;
  game_record: Json;
  counts_for_stats: boolean;
  played_at: string;
  created_at: string;
}

export interface GameLogParticipantRow {
  id: number;
  game_log_id: string;
  member_id: string | null;
  position: TurnPosition;
  is_winner: boolean | null;
  is_draw: boolean;
  is_resign: boolean;
  nickname_snapshot: string;
  title_snapshot: { id: string; name: string; color: TitleColor } | null;
  anonymized: boolean;
}

export interface MemberGameStatsRow {
  member_id: string;
  game_id: string;
  total_games: number;
  wins: number;
  losses: number;
  draws: number;
  resigns: number;
  total_first: number;
  wins_first: number;
  total_second: number;
  wins_second: number;
  last_played_at: string | null;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  target_id: string | null;
  category: ReportCategory;
  reason: string;
  context_kind: ReportContext;
  context_data: Json;
  reporter_snapshot: Json;
  target_snapshot: Json;
  status: ReportStatus;
  resolution: ReportResolution | null;
  resolution_reason: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  admin_memo: string | null;
  created_at: string;
}

export interface InquiryRow {
  id: string;
  author_id: string;
  category: InquiryCategory;
  title: string;
  body: string;
  attachments: Json;
  status: InquiryStatus;
  reason_tag: string | null;
  answer_body: string | null;
  answered_by: string | null;
  answered_at: string | null;
  reply_body: string | null;
  replied_at: string | null;
  admin_memo: string | null;
  auto_close_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: number;
  member_id: string;
  kind: NotificationKind;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SanctionRow {
  id: number;
  member_id: string;
  kind: SanctionKind;
  reason: string;
  starts_at: string;
  ends_at: string | null;
  issued_by: string;
  related_report_id: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: string;
}

export interface AdminActionRow {
  id: number;
  actor_id: string | null;
  action_kind: string;
  target_kind: AdminTargetKind;
  target_id: string | null;
  payload: Json;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface GameRow {
  id: string;
  name: string;
  description: string;
  min_players: number;
  max_players: number;
  supports_multi: boolean;
  supports_com: boolean;
  supports_solo: boolean;
  is_active: boolean;
  sort_order: number;
  bayesian_c: number;
  ranking_active: boolean;
  created_at: string;
}


export interface BannedWordRow {
  id: number;
  word: string;
  scope: BannedWordScope;
  created_at: string;
  created_by: string | null;
}

export interface NoticeRow {
  id: string;
  category: NoticeCategory;
  title: string;
  body: string;
  is_pinned: boolean;
  is_published: boolean;
  published_at: string;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface RankSeasonRow {
  id: number;
  name: string;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export interface RankStatsRow {
  id: string;
  season_id: number;
  member_id: string;
  tier: RankTier;
  rp: number;
  win_streak: number;
  loss_streak: number;
  placement_done: boolean;
  placement_games: number;
  placement_wins: number;
  season_wins: number;
  season_losses: number;
  season_draws: number;
  season_peak_tier: RankTier;
  season_final_tier: RankTier | null;
  updated_at: string;
}

export interface RankMatchHistoryRow {
  id: string;
  season_id: number;
  game_log_id: string | null;
  winner_id: string;
  winner_tier: string;
  winner_rp_before: number;
  winner_rp_gain: number;
  winner_rp_after: number;
  winner_promoted: boolean;
  loser_id: string;
  loser_tier: string;
  loser_rp_before: number;
  loser_rp_loss: number;
  loser_rp_after: number;
  loser_demoted: boolean;
  game_id: string;
  is_forfeit: boolean;
  played_at: string;
}

// ──────────────────────────────────────────────
// CDP Shop System (member_cdp / cdp_ledger / shop_items / shop_purchases)
// ──────────────────────────────────────────────

export type CdpReason =
  | 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit'
  | 'shop_purchase' | 'admin_adjust';

export type CdpRefKind = 'rank_match' | 'shop_purchase' | 'admin_action';

export interface MemberCdpRow {
  member_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface CdpLedgerRow {
  id: string;
  member_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  ref_kind: string;
  ref_id: string | null;
  metadata: Json;
  created_at: string;
}

export interface ShopItemRow {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  payload: Json;
  stock: number | null;
  is_active: boolean;
  is_limited: boolean;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ShopPurchaseRow {
  id: string;
  member_id: string;
  item_id: string;
  price_paid: number;
  payload_snapshot: Json;
  name_snapshot: string;
  type_snapshot: string;
  purchased_at: string;
}

// CDP Shop v2 — 소모성 인벤토리 / 사용 로그 / 조정 로그
export interface ShopConsumableInventoryRow {
  member_id: string;
  kind: string;
  count: number;
  updated_at: string;
}

export interface ShopConsumableUsesRow {
  id: string;
  member_id: string;
  kind: string;
  ref_kind: string;
  ref_id: string;
  metadata: Json;
  used_at: string;
}

export interface ShopConsumableInventoryLogRow {
  purchase_id: string;
  member_id: string;
  kind: string;
  delta: number;
  applied_at: string;
}

// ──────────────────────────────────────────────
// Database 타입 (Supabase 클라이언트 제네릭)
// ──────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      members: { Row: MemberRow; Insert: Partial<MemberRow> & { id: string; nickname: string }; Update: Partial<MemberRow> };
      members_private: { Row: MemberPrivateRow; Insert: Partial<MemberPrivateRow> & { member_id: string }; Update: Partial<MemberPrivateRow> };
      nickname_history: { Row: NicknameHistoryRow; Insert: Omit<NicknameHistoryRow, 'id' | 'changed_at'> & { changed_at?: string }; Update: Partial<NicknameHistoryRow> };
      agreement_versions: { Row: AgreementVersionRow; Insert: Partial<AgreementVersionRow> & { kind: AgreementKind; version: number; body: string }; Update: Partial<AgreementVersionRow> };
      member_agreements: { Row: MemberAgreementRow; Insert: Omit<MemberAgreementRow, 'id' | 'agreed_at'> & { agreed_at?: string }; Update: Partial<MemberAgreementRow> };
      titles: { Row: TitleRow; Insert: Partial<TitleRow> & { name: string; color: TitleColor }; Update: Partial<TitleRow> };
      member_titles: { Row: MemberTitleRow; Insert: Omit<MemberTitleRow, 'id' | 'granted_at'> & { granted_at?: string }; Update: Partial<MemberTitleRow> };
      game_logs: { Row: GameLogRow; Insert: Partial<GameLogRow> & { game_id: string; mode: PlayMode; counts_for_stats: boolean; played_at: string }; Update: Partial<GameLogRow> };
      game_log_participants: { Row: GameLogParticipantRow; Insert: Omit<GameLogParticipantRow, 'id'>; Update: Partial<GameLogParticipantRow> };
      member_game_stats: { Row: MemberGameStatsRow; Insert: Partial<MemberGameStatsRow> & { member_id: string; game_id: string }; Update: Partial<MemberGameStatsRow> };
      reports: { Row: ReportRow; Insert: Partial<ReportRow> & { reporter_id: string; category: ReportCategory; reason: string; context_kind: ReportContext }; Update: Partial<ReportRow> };
      inquiries: { Row: InquiryRow; Insert: Partial<InquiryRow> & { author_id: string; category: InquiryCategory; title: string; body: string }; Update: Partial<InquiryRow> };
      notifications: { Row: NotificationRow; Insert: Omit<NotificationRow, 'id' | 'created_at'> & { created_at?: string }; Update: Partial<NotificationRow> };
      sanctions: { Row: SanctionRow; Insert: Omit<SanctionRow, 'id' | 'created_at'> & { created_at?: string }; Update: Partial<SanctionRow> };
      admin_actions: { Row: AdminActionRow; Insert: Omit<AdminActionRow, 'id' | 'created_at'> & { created_at?: string }; Update: Partial<AdminActionRow> };
      games: { Row: GameRow; Insert: Omit<GameRow, 'created_at'> & { created_at?: string }; Update: Partial<GameRow> };
      banned_words: { Row: BannedWordRow; Insert: Omit<BannedWordRow, 'id' | 'created_at'> & { created_at?: string }; Update: Partial<BannedWordRow> };
      notices: { Row: NoticeRow; Insert: Partial<NoticeRow> & { title: string; body: string }; Update: Partial<NoticeRow> };
      rank_seasons: {
        Row: RankSeasonRow;
        Insert: Omit<RankSeasonRow, 'id'> & { id?: number };
        Update: Partial<RankSeasonRow>;
      };
      rank_stats: {
        Row: RankStatsRow;
        Insert: Omit<RankStatsRow, 'id' | 'updated_at'> & { id?: string; updated_at?: string };
        Update: Partial<RankStatsRow>;
      };
      rank_match_history: {
        Row: RankMatchHistoryRow;
        Insert: Omit<RankMatchHistoryRow, 'id' | 'played_at'> & { id?: string; played_at?: string };
        Update: Partial<RankMatchHistoryRow>;
      };
      member_cdp: {
        Row: MemberCdpRow;
        Insert: Partial<MemberCdpRow> & { member_id: string };
        Update: Partial<MemberCdpRow>;
      };
      cdp_ledger: {
        Row: CdpLedgerRow;
        Insert: Omit<CdpLedgerRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<CdpLedgerRow>;
      };
      shop_items: {
        Row: ShopItemRow;
        Insert: Partial<ShopItemRow> & { type: string; name: string; price: number };
        Update: Partial<ShopItemRow>;
      };
      shop_purchases: {
        Row: ShopPurchaseRow;
        Insert: Omit<ShopPurchaseRow, 'id' | 'purchased_at'> & { id?: string; purchased_at?: string };
        Update: Partial<ShopPurchaseRow>;
      };
      shop_consumable_inventory: {
        Row: ShopConsumableInventoryRow;
        Insert: Omit<ShopConsumableInventoryRow, 'updated_at'> & { updated_at?: string };
        Update: Partial<ShopConsumableInventoryRow>;
      };
      shop_consumable_uses: {
        Row: ShopConsumableUsesRow;
        Insert: Omit<ShopConsumableUsesRow, 'id' | 'used_at'> & { id?: string; used_at?: string };
        Update: Partial<ShopConsumableUsesRow>;
      };
      shop_consumable_inventory_log: {
        Row: ShopConsumableInventoryLogRow;
        Insert: Omit<ShopConsumableInventoryLogRow, 'applied_at'> & { applied_at?: string };
        Update: Partial<ShopConsumableInventoryLogRow>;
      };
    };
    Views: {
      public_member_titles: { Row: { member_id: string; title_id: string; granted_at: string } };
      members_directory: {
        Row: {
          id: string;
          nickname: string;
          created_at: string;
          withdrawn_at: string | null;
          displayed_title: { id: string; name: string; color: TitleColor } | null;
        };
      };
      reports_for_reporter: { Row: Omit<ReportRow, 'admin_memo'> };
    };
    Functions: {
      // 헬퍼
      current_member_id: { Args: Record<string, never>; Returns: string };
      is_admin: { Args: { uid?: string }; Returns: boolean };
      is_active_member: { Args: { uid?: string }; Returns: boolean };

      // 회원
      check_nickname_available: { Args: { p_nick: string }; Returns: boolean };
      complete_signup: { Args: { p_nickname: string; p_agreed_versions: Json }; Returns: void };
      change_nickname: { Args: { p_new_nick: string }; Returns: void };
      update_member_settings: { Args: { p_patch: Json }; Returns: void };
      set_displayed_title: { Args: { p_title_id: string | null }; Returns: void };
      withdraw_member: { Args: { p_confirm_nick: string }; Returns: void };
      mark_notification_read: { Args: { p_id: number }; Returns: void };

      // 신고/문의
      submit_report: {
        Args: {
          p_target_id: string;
          p_category: ReportCategory;
          p_reason: string;
          p_context_kind: ReportContext;
          p_context_data?: Json;
        };
        Returns: string;
      };
      submit_inquiry: {
        Args: {
          p_category: InquiryCategory;
          p_title: string;
          p_body: string;
          p_attachments?: Json;
          p_reason_tag?: string;
        };
        Returns: string;
      };
      member_reply_inquiry: { Args: { p_id: string; p_body: string }; Returns: void };

      /** 공지 상세 조회 기록 (유레카 히든 트리거용) */
      record_notice_read: { Args: { p_notice_id: string }; Returns: void };

      // 게임 종료 (서버 전용)
      record_game_end: {
        Args: {
          p_game_id: string;
          p_mode: PlayMode;
          p_room_snapshot: Json;
          p_result: Json;
          p_play_time_seconds: number;
          p_total_turns: number;
          p_game_record: Json;
          p_played_at: string;
          p_participants: Json;
        };
        Returns: string;
      };

      /** 랭크 리더보드 (배치 완료·언랭 제외) */
      get_rank_leaderboard: {
        Args: { p_season_id: number; p_limit?: number };
        Returns: Array<{
          rank_position: number;
          member_id: string;
          nickname: string;
          title_name: string | null;
          title_color: TitleColor | null;
          tier: RankTier;
          rp: number;
          season_wins: number;
          season_losses: number;
          is_challenger: boolean;
        }>;
      };
      /** 시즌 종료 + 해당 시즌 플레이어 랭크 리셋 (service_role) */
      admin_end_season: { Args: { p_season_id: number }; Returns: void };
      /** 새 시즌 시작 — 진행 중 시즌 없을 때만 (service_role) */
      admin_start_season: { Args: { p_name?: string | null }; Returns: number };
      /** 관리자 RP 상대 조정 (service_role). 감사 로그 기록 */
      admin_adjust_rank_rp: {
        Args: {
          p_actor_id: string;
          p_member_id: string;
          p_season_id: number;
          p_delta: number;
          p_reason: string;
        };
        Returns: void;
      };

      // 랭킹
      compute_ranking: {
        Args: {
          p_game_id: string;
          p_period?: 'weekly' | 'monthly' | 'all';
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
          rank: number;
          member_id: string;
          nickname: string;
          title: { id: string; name: string; color: TitleColor } | null;
          total_games: number;
          wins: number;
          win_rate: number;
          score: number;
          total_count: number;
        }>;
      };
      compute_ranking_all: {
        Args: {
          p_period?: 'weekly' | 'monthly' | 'all';
          p_limit?: number;
          p_offset?: number;
        };
        Returns: Array<{
          rank: number;
          member_id: string;
          nickname: string;
          title: { id: string; name: string; color: TitleColor } | null;
          total_games: number;
          wins: number;
          win_rate: number;
          score: number;
          total_count: number;
        }>;
      };
      my_rank: {
        Args: { p_game_id: string; p_period?: 'weekly' | 'monthly' | 'all' };
        Returns: Array<{ rank: number; total_games: number; wins: number; win_rate: number; score: number }>;
      };

      // 관리자
      admin_create_title: {
        Args: {
          p_name: string;
          p_color: TitleColor;
          p_description?: string;
          p_condition_text?: string;
        };
        Returns: string;
      };
      admin_grant_title: { Args: { p_member_id: string; p_title_id: string; p_reason?: string }; Returns: void };
      admin_revoke_title: { Args: { p_member_id: string; p_title_id: string; p_reason?: string }; Returns: void };
      admin_suspend_member: { Args: { p_member_id: string; p_until: string; p_reason: string; p_related_report_id?: string }; Returns: void };
      admin_ban_member: { Args: { p_member_id: string; p_reason: string; p_related_report_id?: string }; Returns: void };
      admin_lift_sanction: { Args: { p_member_id: string; p_reason?: string }; Returns: void };
      admin_resolve_report: { Args: { p_report_id: string; p_resolution: ReportResolution; p_reason?: string; p_sanction_until?: string }; Returns: void };
      admin_reject_report: { Args: { p_report_id: string; p_reason?: string }; Returns: void };
      admin_answer_inquiry: { Args: { p_id: string; p_body: string }; Returns: void };
      admin_set_role: { Args: { p_member_id: string; p_role: 'user' | 'admin' }; Returns: void };

      // 공지사항 (v2.7)
      admin_create_notice: {
        Args: {
          p_title: string;
          p_body: string;
          p_category?: NoticeCategory;
          p_is_pinned?: boolean;
          p_is_published?: boolean;
        };
        Returns: string;
      };
      admin_update_notice: {
        Args: {
          p_id: string;
          p_title?: string;
          p_body?: string;
          p_category?: NoticeCategory;
        };
        Returns: void;
      };
      admin_toggle_notice_pin: { Args: { p_id: string; p_pinned: boolean }; Returns: void };
      admin_set_notice_published: { Args: { p_id: string; p_published: boolean }; Returns: void };
      admin_delete_notice: { Args: { p_id: string }; Returns: void };

      // 히든 칭호 / 공개 칭호 (v2.11)
      system_grant_hidden_title: {
        Args: {
          p_title_key: string;
          p_title_name: string;
          p_title_color: TitleColor;
          p_title_description: string;
          p_title_condition_text: string;
          p_member_id: string;
        };
        Returns: {
          granted: boolean;
          reason?: string;
          title_id: string;
          holder_id?: string;
          created: boolean;
        };
      };
      admin_restore_member: {
        Args: { p_member_id: string; p_reason?: string | null };
        Returns: void;
      };
      list_public_titles: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          name: string;
          color: TitleColor;
          description: string | null;
          condition_text: string | null;
          is_system: boolean;
          holder_count: number;
          first_granted_at: string | null;
        }>;
      };
      get_public_title_holders: {
        Args: { p_title_id: string };
        Returns: Array<{
          member_id: string;
          nickname: string;
          granted_at: string;
        }>;
      };

      // CDP Shop System
      grant_cdp_for_rank_match: {
        Args: {
          p_member_id: string;
          p_rank_match_id: string;
          p_amount: number;
          p_reason: 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit';
          p_metadata?: Json;
        };
        Returns: Array<{ inserted: boolean; new_balance: number }>;
      };
      purchase_shop_item: {
        Args: { p_member_id: string; p_item_id: string };
        Returns: Array<{
          purchase_id: string;
          new_balance: number;
          price_paid: number;
          price_original: number;
          discount_applied: number;
          stock_after: number | null;
          granted_title_id: string | null;
          consumable_kind: string | null;
          consumable_added: number;
        }>;
      };
      admin_adjust_cdp: {
        Args: {
          p_actor_id: string;
          p_member_id: string;
          p_delta: number;
          p_reason: string;
        };
        Returns: Array<{ new_balance: number; applied_delta: number; clamped: boolean }>;
      };
      admin_create_shop_item: {
        Args: {
          p_actor_id: string;
          p_type: string;
          p_name: string;
          p_description: string;
          p_price: number;
          p_payload: Json;
          p_stock: number | null;
          p_is_active: boolean;
          p_is_limited: boolean;
          p_available_from: string | null;
          p_available_until: string | null;
          p_sort_order: number;
        };
        Returns: string;
      };
      admin_update_shop_item: {
        Args: {
          p_actor_id: string;
          p_item_id: string;
          p_name: string;
          p_description: string;
          p_price: number;
          p_payload: Json;
          p_stock: number | null;
          p_is_limited: boolean;
          p_available_from: string | null;
          p_available_until: string | null;
          p_sort_order: number;
        };
        Returns: void;
      };
      admin_set_shop_item_active: {
        Args: { p_actor_id: string; p_item_id: string; p_active: boolean };
        Returns: void;
      };

      // CDP Shop v2 — 소모성 / 거상 / 칭호 추가
      use_consumable: {
        Args: {
          p_member_id: string;
          p_kind: ConsumableKind | string;
          p_ref_kind: string;
          p_ref_id: string;
          p_metadata?: Json;
        };
        Returns: Array<{ used: boolean; count_after: number; use_id: string | null }>;
      };
      change_nickname_with_ticket: {
        Args: { p_new_nick: string; p_use_ticket?: boolean };
        Returns: Array<{ used_ticket: boolean; ticket_count_after: number }>;
      };
      use_rank_reset_ticket: {
        Args: { p_member_id: string; p_season_id: number };
        Returns: Array<{ success: boolean; used_count_in_season: number; ticket_count_after: number }>;
      };
      admin_grant_consumable: {
        Args: {
          p_actor_id: string;
          p_member_id: string;
          p_kind: ConsumableKind | string;
          p_delta: number;
          p_reason: string;
        };
        Returns: Array<{ count_after: number; applied_delta: number; clamped: boolean }>;
      };
    };
    Enums: {
      member_status: MemberStatus;
      member_role: MemberRole;
      play_mode: PlayMode;
      turn_position: TurnPosition;
      title_color: TitleColor;
      agreement_kind: AgreementKind;
      report_category: ReportCategory;
      report_status: ReportStatus;
      report_resolution: ReportResolution;
      report_context: ReportContext;
      inquiry_category: InquiryCategory;
      inquiry_status: InquiryStatus;
      sanction_kind: SanctionKind;
      notification_kind: NotificationKind;
      admin_target_kind: AdminTargetKind;
      banned_word_scope: BannedWordScope;
      notice_category: NoticeCategory;
    };
  };
}
