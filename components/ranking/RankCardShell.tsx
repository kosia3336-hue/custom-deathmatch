import type { ReactNode } from 'react';
import { Card } from '@/components/cdm/Card';
import { cn } from '@/lib/utils';
import type { RankCardSkinId } from '@shared/rank-card-skins';

export function RankCardShell({
  skin,
  highlight = false,
  className,
  bodyClassName,
  children,
}: {
  skin?: RankCardSkinId | null;
  highlight?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card
      variant={skin ? 'default' : highlight ? 'highlight' : 'default'}
      accent="primary"
      className={cn(
        skin && `rank-card-skin rank-card-skin-${skin} relative overflow-hidden`,
        className,
      )}
    >
      {skin ? (
        <>
          <span className="rank-card-skin-fx" aria-hidden />
          <span className="rank-card-skin-fx2" aria-hidden />
        </>
      ) : null}
      <div className={cn(skin && 'rank-card-skin-body', bodyClassName)}>{children}</div>
    </Card>
  );
}
