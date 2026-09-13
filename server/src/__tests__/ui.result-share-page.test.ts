import { describe, expect, it } from 'vitest';
import { createResultShareToken, verifyResultShareToken } from '../../../lib/share/resultToken';
import {
  buildResultShareView,
  describeResultShare,
  formatShareOpponents,
  type ShareLogRow,
  type ShareParticipantRow,
} from '../../../lib/share/resultShareView';
import {
  buildPublicLogProps,
  type PublicLogRow,
  type PublicParticipantRow,
} from '../../../lib/share/publicLogProps';

const LOG_ID = 'e46ffff9-4c89-47e5-9b5c-7f02adcd97da';
const SECRET = 'test-secret';

describe('결과 공유 토큰', () => {
  it('발급한 토큰은 같은 판·같은 자리로 풀린다', () => {
    const token = createResultShareToken(LOG_ID, 'first', SECRET);
    expect(token).toHaveLength(55);
    expect(verifyResultShareToken(token, SECRET)).toEqual({ logId: LOG_ID, position: 'first' });
    const second = createResultShareToken(LOG_ID.toUpperCase(), 'second', SECRET);
    expect(verifyResultShareToken(second, SECRET)).toEqual({ logId: LOG_ID, position: 'second' });
  });

  it('로그 id·자리·서명을 바꾸거나 다른 키면 열리지 않는다', () => {
    const token = createResultShareToken(LOG_ID, 'first', SECRET);
    const otherLog = `0${token.slice(1)}`;
    const otherSeat = `${token.slice(0, 32)}s${token.slice(33)}`;
    const otherSig = `${token.slice(0, 54)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(verifyResultShareToken(otherLog, SECRET)).toBeNull();
    expect(verifyResultShareToken(otherSeat, SECRET)).toBeNull();
    expect(verifyResultShareToken(otherSig, SECRET)).toBeNull();
    expect(verifyResultShareToken(token, 'other-secret')).toBeNull();
  });

  it('모양이 틀린 토큰은 거절하고, 로그 id 가 아니면 발급하지 않는다', () => {
    expect(verifyResultShareToken('', SECRET)).toBeNull();
    expect(verifyResultShareToken('x'.repeat(55), SECRET)).toBeNull();
    expect(verifyResultShareToken(`${'a'.repeat(32)}x${'b'.repeat(22)}`, SECRET)).toBeNull();
    expect(() => createResultShareToken('not-a-uuid', 'first', SECRET)).toThrow();
  });
});

const log: ShareLogRow = {
  id: LOG_ID,
  game_id: 'game-003',
  played_at: '2026-09-13T14:43:35Z',
  play_time_seconds: 182,
  total_turns: 18,
  room_snapshot: { gameName: '넘버4', title: '[랭크] 넘버4' },
};

const seat = (over: Partial<ShareParticipantRow>): ShareParticipantRow => ({
  position: 'first',
  member_id: 'm1',
  nickname_snapshot: '쇼비',
  anonymized: false,
  is_winner: true,
  is_draw: false,
  is_resign: false,
  ...over,
});

describe('결과 공유 화면 값', () => {
  const opponent = seat({ position: 'second', member_id: 'm2', nickname_snapshot: '샤인', is_winner: false });

  it('공유한 자리 입장의 승패와 양쪽 이름을 만든다', () => {
    const view = buildResultShareView(log, [seat({}), opponent], 'first', { isRanked: true });
    expect(view).toMatchObject({
      gameName: '넘버4',
      result: 'win',
      resultLabel: '승리',
      sharerNickname: '쇼비',
      opponents: ['샤인'],
      playTimeMs: 182_000,
      isRanked: true,
    });
    expect(describeResultShare(view!)).toBe('승리 vs 샤인 · 2026.09.13 23:43 · 플레이 3분 2초 · 18턴');
    expect(buildResultShareView(log, [seat({}), opponent], 'second', { isRanked: true })?.resultLabel).toBe('패배');
  });

  it('상대가 익명 물약을 쓴 판이면 상대 이름은 ??? 로 가린다', () => {
    const anon = seat({ ...opponent, anonymized: true });
    expect(buildResultShareView(log, [seat({}), anon], 'first', { isRanked: true })?.opponents).toEqual(['???']);
  });

  it('무승부·기권·자리 없음을 구분한다', () => {
    const draw = [seat({ is_winner: null, is_draw: true }), seat({ ...opponent, is_winner: null, is_draw: true })];
    expect(buildResultShareView(log, draw, 'first', { isRanked: false })?.resultLabel).toBe('무승부');
    const resign = [seat({ is_winner: false, is_resign: true }), seat({ ...opponent, is_winner: true })];
    expect(buildResultShareView(log, resign, 'first', { isRanked: false })?.resultLabel).toBe('기권');
    expect(buildResultShareView(log, [opponent], 'first', { isRanked: false })).toBeNull();
  });

  it('상대가 많으면 앞 두 명 + 외 n명', () => {
    expect(formatShareOpponents(['가', '나', '다', '라'])).toBe('가, 나 외 2명');
  });
});

describe('공개 기보', () => {
  const title = (name: string) =>
    ({ id: `t-${name}`, name, color: 'gold' }) as PublicParticipantRow['title_snapshot'];
  const fullLog = {
    ...log,
    mode: 'multi',
    counts_for_stats: true,
    game_record: {
      players: { tokenA: { nickname: '쇼비' }, tokenB: { nickname: '창조적인플레이' } },
      tiebreakerReason: '창조적인플레이 님 승리',
    },
  } as PublicLogRow;

  it('익명 물약 상대는 목록·순위·기록 본문까지 ??? 로 가리고 회원 id 는 싣지 않는다', () => {
    const rows: PublicParticipantRow[] = [
      { ...seat({}), title_snapshot: title('사목러') },
      {
        ...seat({ position: 'second', member_id: 'member-b', nickname_snapshot: '창조적인플레이', anonymized: true, is_winner: false }),
        title_snapshot: title('숨길칭호'),
      },
    ];
    const props = buildPublicLogProps(fullLog, rows, 'first', '넘버4');
    expect(props.players.map((p) => p.nickname)).toEqual(['쇼비', '???']);
    expect(props.players[1].title).toBeNull();
    expect(props.record.result.rankings.map((r: { nickname: string }) => r.nickname)).toEqual(['쇼비', '???']);
    const json = JSON.stringify(props);
    expect(json).not.toContain('창조적인플레이');
    expect(json).not.toContain('숨길칭호');
    expect(json).not.toContain('member-b');
    expect(json).toContain('??? 님 승리');
  });

  it('공유한 사람 본인이 물약을 쓴 판이어도 본인 이름은 보인다', () => {
    const rows: PublicParticipantRow[] = [
      { ...seat({ anonymized: true }), title_snapshot: null },
      { ...seat({ position: 'second', member_id: 'member-b', nickname_snapshot: '샤인', is_winner: false }), title_snapshot: null },
    ];
    expect(buildPublicLogProps(fullLog, rows, 'first', '넘버4').players.map((p) => p.nickname)).toEqual([
      '쇼비',
      '샤인',
    ]);
  });
});
