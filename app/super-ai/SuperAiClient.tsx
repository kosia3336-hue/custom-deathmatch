'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button, Card, EmptyState, Tag } from '@/components/cdm';
import { connectSocket, getSocket } from '@/lib/socket';
import { useNicknameStore } from '@/stores/nickname';
import { SUPER_AI_GAMES, superAiAdvisorHref } from '@/shared/types';
import { formatTime } from '@/lib/utils';
import {
  superAiGameName,
  superAiWinnerLabel,
  type SuperAiGameRow,
} from '@/lib/super-ai/kifu';

const BLURB: Record<string, string> = {
  'game-001': '9×9 보드. 돌을 놓고 중력을 민다.',
  'game-002': '5×5 양면장기. 포로를 다시 놓을 수 있다.',
  'game-003': '백·흑·넘버를 받고, 성공·실패는 당신이 넣는다.',
  'game-006': '역할과 승부·베팅을 받고, 공개된 상대 수는 당신이 넣는다.',
  'game-007': '타일과 의심을 받고, 색·의심·크기는 당신이 넣는다.',
  'game-008': '카드를 받고, 공개된 상대 카드는 당신이 넣는다. 한 라운드가 아니라 게임을 이긴다.',
  'game-009': '포인트를 받는다. 상대 숫자는 마스킹. 색·불·승패만 넣는다. 기보+90초로 10점을 이긴다.',
  'game-010': '타일을 받고, 자릿수와 공개된 상대 타일은 당신이 넣는다. 한 라운드가 아니라 6선승 운영을 이긴다.',
  'game-011': '행동을 받고, 마일스톤과 공개된 상대 수는 당신이 넣는다. 한 수가 아니라 3점을 이긴다.',
  'game-012': '카드와 설탕을 받고, 공개된 상대 제출은 당신이 넣는다. 한 라운드가 아니라 게임을 이긴다.',
  'game-013': '빛가루와 칩을 받고, 표시등과 점등은 당신이 넣는다. 상대 정확 빛가루는 모른다. 한 라운드가 아니라 칩으로 이긴다.',
  'game-014': '베팅을 받고, 선 장수와 공개된 패자 금액은 당신이 넣는다. 상대 권종·승자 금액은 모른다. 한 라운드가 아니라 점수로 이긴다.',
  'game-017': '멀리건·오픈·교환을 받고, 상대 오픈과 받은 카드는 당신이 넣는다. 상대 미오픈과 가상 플레이어 숨은 패는 모른다. 한 수가 아니라 콰트로로 이긴다.',
};

export default function SuperAiClient({
  nickname,
  kifu,
}: {
  nickname: string;
  kifu: SuperAiGameRow[];
}) {
  const router = useRouter();
  const [busyId, setBusy] = useState<string | null>(null);

  async function start(gameId: string) {
    if (busyId) return;
    setBusy(gameId);
    try {
      const s = await connectSocket();
      if (!s.connected) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('소켓 연결 시간 초과')), 8000);
          s.once('connect', () => {
            clearTimeout(t);
            resolve();
          });
        });
      }
      if (!useNicknameStore.getState().nickname) {
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            s.off('session:restored', done);
            s.off('session:new', done);
            resolve();
          };
          s.once('session:restored', done);
          s.once('session:new', done);
          setTimeout(done, 1200);
        });
      }

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => {
          reject(new Error('서버가 슈퍼 AI 시작을 받지 않습니다. 소켓 서버를 확인하세요.'));
        }, 8000);
        getSocket().emit('superAi:start', { gameId }, (res) => {
          clearTimeout(t);
          if (!res.success || !res.roomId) {
            reject(new Error(res.error ?? '게임을 시작하지 못했습니다.'));
            return;
          }
          router.push(`/room/${res.roomId}/play`);
          resolve();
        });
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '게임을 시작하지 못했습니다.');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-cdm-fg-muted">
        {nickname} · 사목·양면은 흑과 백을 직접 두고, 판 안에서 <strong>슈퍼 AI 쓰기</strong>를
        켜면 양측을 AI가 이어서 둔다. 넘버4·베팅 가위바위보·배수 흑과 백·연승·흑과백2·실퍼의 흑과백·5개의 탑·포도설탕2·해달별2·은행놀이·콰트로는 대국이 아니라 수를 받는
        자문이다. 끝난 판은 전적과 따로 기보로 남는다.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {SUPER_AI_GAMES.map((game) => (
          <li key={game.id}>
            <Card className="flex h-full flex-col gap-4">
              <div>
                <h2 className="text-lg font-semibold text-cdm-fg">{game.name}</h2>
                <p className="mt-1 text-sm text-cdm-fg-muted">{BLURB[game.id]}</p>
              </div>
              {superAiAdvisorHref(game.id) ? (
                <Button
                  type="button"
                  fullWidth
                  disabled={busyId !== null}
                  onClick={() => router.push(superAiAdvisorHref(game.id)!)}
                >
                  자문 열기
                </Button>
              ) : (
                <Button
                  type="button"
                  fullWidth
                  loading={busyId === game.id}
                  disabled={busyId !== null && busyId !== game.id}
                  onClick={() => void start(game.id)}
                >
                  게임 시작
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-cdm-fg">저장한 기보</h2>
        {kifu.length === 0 ? (
          <Card>
            <EmptyState
              title="아직 기보가 없다"
              description="한 판을 끝내면 수순이 여기에 쌓인다."
            />
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {kifu.map((row) => (
              <li key={row.id}>
                <Link href={`/super-ai/${row.id}`}>
                  <Card variant="interactive" className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-cdm-fg">{superAiGameName(row.game_id)}</span>
                    <Tag>{superAiWinnerLabel(row)}</Tag>
                    <span className="text-xs text-cdm-fg-muted">
                      {row.total_turns}턴 · AI {row.ai_turns}수 · {formatTime(row.play_time_seconds * 1000)}
                    </span>
                    <span className="ml-auto text-xs text-cdm-fg-muted">
                      {new Date(row.played_at).toLocaleString('ko-KR')}
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
