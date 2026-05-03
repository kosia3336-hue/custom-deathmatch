import Link from 'next/link';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import type { CurrentMember } from '@/lib/auth/server';

export default function OverviewTab({ member }: { member: CurrentMember }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">누적 전적</h2>
        <p className="mt-2 text-2xl font-bold text-cdm-fg">0판</p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">표시 칭호</h2>
        <p className="mt-2 text-cdm-fg">
          {member.displayedTitle ? (
            <span className="text-base font-semibold">[{member.displayedTitle.name}]</span>
          ) : (
            <span className="text-cdm-fg-muted text-sm">없음</span>
          )}
        </p>
        <Link href="/me?tab=titles" className="mt-2 inline-block">
          <Button variant="tertiary" size="sm">
            칭호 관리 →
          </Button>
        </Link>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">즐겨 한 게임 Top 3</h2>
        <p className="mt-2 text-sm text-cdm-fg-muted">아직 데이터가 없습니다.</p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-cdm-fg-muted">처리 중 신고/문의</h2>
        <p className="mt-2 text-sm text-cdm-fg-muted">없음</p>
      </Card>
    </div>
  );
}
