import { Card } from '@/components/cdm/Card';
import { GuildMark } from '@/components/cdm/GuildMark';

interface Props {
  rank: number;
  name: string;
  ownerNickname: string;
  memberCount: number;
  capacity: number;
  points: number;
  markUrl: string | null;
  buffCdpLevel: number;
  /** 내가 속한 길드면 강조 */
  highlight: boolean;
}

export default function GuildLeaderRow({
  rank,
  name,
  ownerNickname,
  memberCount,
  capacity,
  points,
  markUrl,
  buffCdpLevel,
  highlight,
}: Props) {
  return (
    <Card
      variant={highlight ? 'highlight' : 'default'}
      accent="primary"
      className="!p-3 flex items-center gap-3"
    >
      <span
        className={`w-10 shrink-0 text-center text-lg font-bold tabular-nums ${
          rank === 1 ? 'text-cdm-highlight' : rank <= 3 ? 'text-cdm-primary' : 'text-cdm-fg-muted'
        }`}
      >
        {rank}
      </span>

      <GuildMark
        mark={markUrl ? { url: markUrl, name } : null}
        size="lg"
        className="h-8 w-8 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-cdm-fg">
            {name}
            {highlight && <span className="ml-1 text-xs text-cdm-fg-muted">(내 길드)</span>}
          </span>
        </div>
        <p className="truncate text-xs text-cdm-fg-muted">
          길드장 {ownerNickname} · {memberCount}/{capacity}명
          {buffCdpLevel > 0 && <span className="text-cdm-primary"> · CDP +{buffCdpLevel}%</span>}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-lg font-bold tabular-nums text-cdm-primary">
          {points.toLocaleString()}
        </p>
        <p className="text-[10px] text-cdm-fg-muted">GP</p>
      </div>
    </Card>
  );
}
