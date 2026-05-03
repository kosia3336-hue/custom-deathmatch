import { Card } from '@/components/cdm/Card';
import type { NicknameHistoryData, SanctionData } from './types';

const SANCTION_LABELS: Record<string, string> = {
  warning: '주의',
  suspension: '일시정지',
  ban: '영구정지',
  lift: '제재 해제',
};

const SANCTION_CARD_BG: Record<string, string> = {
  warning: 'bg-amber-500/10',
  suspension: 'bg-orange-500/10',
  ban: 'bg-red-500/10',
  lift: 'bg-emerald-500/10',
};

const SANCTION_BADGE_STYLE: Record<string, string> = {
  warning: 'bg-amber-400/20 text-amber-400',
  suspension: 'bg-orange-400/20 text-orange-400',
  ban: 'bg-red-400/20 text-red-400',
  lift: 'bg-emerald-400/20 text-emerald-400',
};

interface Props {
  nicknameHistory: NicknameHistoryData[];
  sanctions: SanctionData[];
}

export default function LogSection({ nicknameHistory, sanctions }: Props) {
  return (
    <div className="flex flex-col gap-6">
      {/* 닉네임 변경 이력 */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg-muted">닉네임 변경 이력</h3>
        {nicknameHistory.length === 0 ? (
          <p className="text-xs text-cdm-fg-subtle">변경 이력이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {nicknameHistory.map((n) => (
              <Card key={n.id} className="!p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm text-cdm-fg">
                    <span className="line-through text-cdm-fg-muted">{n.old_nickname}</span>
                    {' → '}
                    <span className="font-semibold">{n.new_nickname}</span>
                  </span>
                  <span className="text-xs text-cdm-fg-subtle">
                    {new Date(n.changed_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 제재 이력 */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-cdm-fg-muted">제재 이력</h3>
        {sanctions.length === 0 ? (
          <p className="text-xs text-cdm-fg-subtle">제재 이력이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sanctions.map((s) => (
              <Card key={s.id} className={`!p-3 ${SANCTION_CARD_BG[s.kind] ?? ''}`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-cdm-sm px-1.5 py-0.5 text-[11px] font-semibold ${SANCTION_BADGE_STYLE[s.kind] ?? 'bg-cdm-bg-elev-2 text-cdm-fg'}`}>
                      {SANCTION_LABELS[s.kind] ?? s.kind}
                    </span>
                    <span className="text-xs text-cdm-fg">{s.reason}</span>
                  </div>
                  <span className="text-xs text-cdm-fg-subtle">
                    {new Date(s.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="mt-1 text-xs text-cdm-fg-muted">
                  처리: {s.issuer_nickname ?? s.issued_by.slice(0, 6)}
                  {s.ends_at && ` · 종료: ${new Date(s.ends_at).toLocaleDateString('ko-KR')}`}
                  {s.revoked_at &&
                    ` · 해제: ${new Date(s.revoked_at).toLocaleDateString('ko-KR')}${s.revoked_reason ? ` (${s.revoked_reason})` : ''}`}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
