'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { GuildMark } from '@/components/cdm/GuildMark';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { catalogLogoIdFromUrl, DEV_GUILD_LOGOS, devGuildLogoSrc } from '@/components/guild-v4/logoCatalog';
import { guildSpendReasonKo } from '@/lib/admin/guild-spend-reason';
import { GUILD_MAX_CAPACITY, isValidGuildName } from '@/lib/guild/types';
import { cn } from '@/lib/utils';

export type AdminGuildDetail = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  ownerNickname: string;
  capacity: number;
  points: number;
  createdAt: string;
  disbandedAt: string | null;
  markUrl: string | null;
  buffCdpLevel: number;
};

export type AdminGuildMemberRow = {
  memberId: string;
  nickname: string;
  role: 'owner' | 'vice_owner' | 'member';
  joinedAt: string;
};

export type AdminGuildRequestRow = {
  id: string;
  memberId: string;
  nickname: string;
  createdAt: string;
};

export type AdminGuildLedgerRow = {
  id: number;
  nickname: string;
  delta: number;
  reason: string;
  createdAt: string;
};

const ROLE_KO = {
  owner: '길드장',
  vice_owner: '부길드장',
  member: '길드원',
} as const;

async function postAct(guildId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/admin/guilds/${guildId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !json.ok) throw new Error(json.error ?? '실패했습니다.');
  return json;
}

export default function AdminGuildDetailClient({
  guild,
  members,
  requests,
  ledger,
}: {
  guild: AdminGuildDetail;
  members: AdminGuildMemberRow[];
  requests: AdminGuildRequestRow[];
  ledger: AdminGuildLedgerRow[];
}) {
  const router = useRouter();
  const disbanded = !!guild.disbandedAt;
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description);
  const [capacity, setCapacity] = useState(String(guild.capacity));
  const [gpDelta, setGpDelta] = useState('');
  const [gpReason, setGpReason] = useState('');
  const [disbandReason, setDisbandReason] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addHits, setAddHits] = useState<{ memberId: string; nickname: string }[]>([]);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    danger?: boolean;
    run: () => Promise<void>;
  } | null>(null);

  async function run(label: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await postAct(guild.id, body);
      toast.success(label);
      setAddHits([]);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start gap-3">
        {guild.markUrl ? (
          <GuildMark mark={{ url: guild.markUrl, name: guild.name }} size="xl" />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-cdm-fg">{guild.name}</h1>
            {disbanded ? (
              <span className="rounded-cdm-sm bg-cdm-bg-elev-2 px-1.5 py-0.5 text-[10px] font-bold text-cdm-fg-muted">
                해체
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            {guild.description || '소개 없음'}
          </p>
          <p className="mt-1 text-xs text-cdm-fg-muted">
            길드장 {guild.ownerNickname || '—'} · {members.length}/{guild.capacity}명 ·{' '}
            {guild.points.toLocaleString('ko-KR')} GP · 버프 레벨 {guild.buffCdpLevel} · 창설{' '}
            {new Date(guild.createdAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      </header>

      {disbanded ? (
        <Card>
          <p className="text-sm text-cdm-fg-muted">해체된 길드는 조회만 됩니다.</p>
        </Card>
      ) : (
        <>
          <Card>
            <h2 className="mb-3 text-base font-semibold text-cdm-fg">프로필</h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-semibold text-cdm-fg-muted">이름 (2~20, 영어·한글)</label>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-cdm-fg-muted">소개 (200자)</label>
                <textarea
                  className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (!isValidGuildName(name)) {
                    toast.error('길드 이름은 영어·한글만, 2~20자입니다.');
                    return;
                  }
                  void run('프로필을 저장했습니다.', {
                    action: 'set_profile',
                    name: name.trim(),
                    description,
                  });
                }}
              >
                저장
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-cdm-fg">정원 · 마크</h2>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="w-28">
                <label className="text-xs font-semibold text-cdm-fg-muted">정원 (3~{GUILD_MAX_CAPACITY})</label>
                <TextInput
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run('정원을 변경했습니다.', {
                    action: 'set_capacity',
                    capacity: Number(capacity),
                  })
                }
              >
                정원 적용
              </Button>
            </div>
            <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {DEV_GUILD_LOGOS.map((logo) => {
                const using = catalogLogoIdFromUrl(guild.markUrl) === logo.id;
                return (
                  <li key={logo.id}>
                    <button
                      type="button"
                      disabled={busy || using}
                      title={logo.name}
                      onClick={() =>
                        void run('마크를 변경했습니다.', { action: 'set_mark', logoId: logo.id })
                      }
                      className={cn(
                        'aspect-square w-full overflow-hidden rounded-cdm-md border',
                        using
                          ? 'border-cdm-primary ring-2 ring-cdm-primary'
                          : 'border-cdm-border hover:border-cdm-border-strong',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={devGuildLogoSrc(logo.id)} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-cdm-fg">GP 조정</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="sm:w-36">
                <label className="text-xs font-semibold text-cdm-fg-muted">변경량</label>
                <TextInput
                  type="number"
                  value={gpDelta}
                  onChange={(e) => setGpDelta(e.target.value)}
                  placeholder="지급 100, 회수 -50"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-cdm-fg-muted">사유</label>
                <TextInput value={gpReason} onChange={(e) => setGpReason(e.target.value)} />
              </div>
              <Button
                size="sm"
                disabled={busy}
                onClick={() =>
                  void run('GP를 조정했습니다.', {
                    action: 'adjust_gp',
                    delta: Number(gpDelta),
                    reason: gpReason.trim(),
                  })
                }
              >
                적용
              </Button>
            </div>
          </Card>
        </>
      )}

      <Card>
        <h2 className="mb-3 text-base font-semibold text-cdm-fg">길드원 {members.length}</h2>
        {!disbanded && (
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[160px] flex-1">
              <TextInput
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="미가입 닉 검색"
              />
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                if (addQuery.trim().length < 2) {
                  toast.error('닉네임 2자 이상');
                  return;
                }
                setBusy(true);
                try {
                  const res = await fetch('/api/admin/guilds/search-member', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: addQuery.trim() }),
                  });
                  const json = (await res.json()) as {
                    rows?: { memberId: string; nickname: string }[];
                    error?: string;
                  };
                  if (!res.ok) {
                    toast.error(json.error ?? '검색 실패');
                    return;
                  }
                  setAddHits(json.rows ?? []);
                  if ((json.rows ?? []).length === 0) toast('미가입 회원이 없습니다.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              검색
            </Button>
          </div>
        )}
        {addHits.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1 text-sm">
            {addHits.map((h) => (
              <li key={h.memberId} className="flex items-center justify-between gap-2">
                <span className="text-cdm-fg">{h.nickname}</span>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void run(`${h.nickname}을(를) 넣었습니다.`, {
                      action: 'add_member',
                      targetMemberId: h.memberId,
                    })
                  }
                >
                  가입
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cdm-border text-left text-xs text-cdm-fg-muted">
                <th className="py-2">닉네임</th>
                <th className="py-2">역할</th>
                <th className="hidden sm:table-cell py-2">가입</th>
                {!disbanded && <th className="py-2 text-right">관리</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.memberId} className="border-b border-cdm-border/50">
                  <td className="py-2">
                    <a href={`/admin/members/${m.memberId}`} className="font-semibold text-cdm-fg hover:underline">
                      {m.nickname}
                    </a>
                  </td>
                  <td className="py-2 text-cdm-fg-muted">{ROLE_KO[m.role]}</td>
                  <td className="hidden sm:table-cell py-2 text-cdm-fg-muted">
                    {new Date(m.joinedAt).toLocaleDateString('ko-KR')}
                  </td>
                  {!disbanded && (
                    <td className="py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {m.role !== 'owner' && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                void run(
                                  m.role === 'vice_owner' ? '부길드장을 해제했습니다.' : '부길드장으로 임명했습니다.',
                                  {
                                    action: 'set_vice',
                                    targetMemberId: m.memberId,
                                    promote: m.role !== 'vice_owner',
                                  },
                                )
                              }
                            >
                              {m.role === 'vice_owner' ? '부길드장 해제' : '부길드장'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: '길드장 위임',
                                  message: `${m.nickname}에게 길드장을 넘기겠습니까?`,
                                  run: () =>
                                    run('길드장을 위임했습니다.', {
                                      action: 'transfer_owner',
                                      targetMemberId: m.memberId,
                                    }),
                                })
                              }
                            >
                              위임
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() =>
                                setConfirm({
                                  title: '추방',
                                  message: `${m.nickname}을(를) 추방하겠습니까?`,
                                  danger: true,
                                  run: () =>
                                    run('추방했습니다.', {
                                      action: 'kick',
                                      targetMemberId: m.memberId,
                                    }),
                                })
                              }
                            >
                              추방
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {!disbanded && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-cdm-fg">가입 신청 {requests.length}</h2>
          {requests.length === 0 ? (
            <p className="text-sm text-cdm-fg-muted">대기 중인 신청이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {requests.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <a href={`/admin/members/${r.memberId}`} className="font-semibold text-cdm-fg hover:underline">
                      {r.nickname}
                    </a>
                    <span className="ml-2 text-xs text-cdm-fg-muted">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </span>
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        void run('승인했습니다.', {
                          action: 'resolve_join',
                          requestId: r.id,
                          approve: true,
                        })
                      }
                    >
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run('거절했습니다.', {
                          action: 'resolve_join',
                          requestId: r.id,
                          approve: false,
                        })
                      }
                    >
                      거절
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-base font-semibold text-cdm-fg">GP 소모 로그 (최근 40)</h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-cdm-fg-muted">소모 기록이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cdm-border text-left text-xs text-cdm-fg-muted">
                  <th className="py-2">시각</th>
                  <th className="py-2">회원</th>
                  <th className="py-2">사유</th>
                  <th className="py-2 text-right">소모</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id} className="border-b border-cdm-border/50">
                    <td className="py-1.5 text-xs text-cdm-fg-muted whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="py-1.5">{r.nickname}</td>
                    <td className="py-1.5 text-cdm-fg-muted">{guildSpendReasonKo(r.reason)}</td>
                    <td className="py-1.5 text-right tabular-nums text-cdm-highlight">
                      {Math.abs(r.delta).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {!disbanded && (
        <Card>
          <h2 className="mb-3 text-base font-semibold text-cdm-fg">해체</h2>
          <p className="mb-2 text-sm text-cdm-fg-muted">
            길드원이 있어도 전원 무소속이 됩니다. 되돌릴 수 없습니다.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-cdm-fg-muted">사유</label>
              <TextInput value={disbandReason} onChange={(e) => setDisbandReason(e.target.value)} />
            </div>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (disbandReason.trim().length < 3) {
                  toast.error('사유는 3~200자입니다.');
                  return;
                }
                setConfirm({
                  title: '길드 해체',
                  message: '길드를 정말 해체하겠습니까?',
                  danger: true,
                  run: () =>
                    run('해체했습니다.', { action: 'disband', reason: disbandReason.trim() }),
                });
              }}
            >
              해체
            </Button>
          </div>
        </Card>
      )}

      {confirm ? (
        <Modal
          open
          onClose={busy ? undefined : () => setConfirm(null)}
          title={confirm.title}
          size="sm"
          footer={
            <>
              <Button variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                취소
              </Button>
              <Button
                variant={confirm.danger ? 'danger' : 'primary'}
                loading={busy}
                onClick={() => void confirm.run()}
              >
                확인
              </Button>
            </>
          }
        >
          <p className="text-sm text-cdm-fg">{confirm.message}</p>
        </Modal>
      ) : null}
    </div>
  );
}
