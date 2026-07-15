import { cn } from '@/lib/utils';
import type { MemberStatus, ReportStatus, InquiryStatus } from '@/lib/supabase/database.types';

type ChipTone = 'success' | 'info' | 'highlight' | 'accent' | 'muted';

const TONE_CLASS: Record<ChipTone, string> = {
  success: 'bg-cdm-success-soft text-[#15803d]',
  info: 'bg-cdm-info-soft text-[#1d4ed8]',
  highlight: 'bg-cdm-highlight-soft text-[#a16207]',
  accent: 'bg-cdm-accent-soft text-[#be123c]',
  muted: 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
};

interface StatusChipProps {
  tone: ChipTone;
  label: string;
  icon?: string;
  className?: string;
}

/** 기본 칩 — 한글 라벨 + 색 + 옵션 이모지. (15번 §15.8) */
export function StatusChip({ tone, label, icon, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold leading-none whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon && <span aria-hidden>{icon}</span>}
      <span>{label}</span>
    </span>
  );
}

// ──────────────────────────────────────────────
// 회원 상태
// ──────────────────────────────────────────────

const MEMBER_STATUS_MAP: Record<MemberStatus, { tone: ChipTone; label: string }> = {
  active: { tone: 'success', label: '정상' },
  suspended: { tone: 'highlight', label: '일시정지' },
  banned: { tone: 'accent', label: '영구정지' },
  withdrawn: { tone: 'muted', label: '탈퇴' },
};

export function MemberStatusChip({
  status,
  className,
}: {
  status: MemberStatus;
  className?: string;
}) {
  const { tone, label } = MEMBER_STATUS_MAP[status];
  return <StatusChip tone={tone} label={label} className={className} />;
}

// ──────────────────────────────────────────────
// 신고 상태
// ──────────────────────────────────────────────

const REPORT_STATUS_MAP: Record<ReportStatus, { tone: ChipTone; label: string; icon: string }> = {
  pending: { tone: 'info', label: '접수', icon: '' },
  processing: { tone: 'highlight', label: '처리 중', icon: '' },
  resolved: { tone: 'accent', label: '인정', icon: '' },
  rejected: { tone: 'muted', label: '반려', icon: '' },
};

export function ReportStatusChip({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  const { tone, label, icon } = REPORT_STATUS_MAP[status];
  return <StatusChip tone={tone} label={label} icon={icon} className={className} />;
}

// ──────────────────────────────────────────────
// 문의 상태
// ──────────────────────────────────────────────

const INQUIRY_STATUS_MAP: Record<InquiryStatus, { tone: ChipTone; label: string; icon?: string }> =
  {
    pending: { tone: 'info', label: '접수', icon: '' },
    processing: { tone: 'highlight', label: '처리 중', icon: '' },
    answered: { tone: 'success', label: '답변 완료', icon: '' },
    replied: { tone: 'highlight', label: '회원 회신', icon: '' },
    closed: { tone: 'muted', label: '종결' },
  };

export function InquiryStatusChip({
  status,
  className,
}: {
  status: InquiryStatus;
  className?: string;
}) {
  const { tone, label, icon } = INQUIRY_STATUS_MAP[status];
  return <StatusChip tone={tone} label={label} icon={icon} className={className} />;
}
