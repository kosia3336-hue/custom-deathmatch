import { describe, expect, it } from 'vitest';
import {
  rankOpponentName,
  withoutAnonymizedOpponents,
  type MatchParticipantRow,
} from '../../../lib/anonymousOpponents';

const rows: MatchParticipantRow[] = [
  { game_log_id: 'log-1', member_id: 'me', nickname_snapshot: '나', anonymized: false },
  { game_log_id: 'log-1', member_id: 'opp', nickname_snapshot: '그때닉', anonymized: false },
  { game_log_id: 'log-2', member_id: 'me', nickname_snapshot: '나', anonymized: false },
  { game_log_id: 'log-2', member_id: 'opp', nickname_snapshot: '그때닉', anonymized: true },
];

describe('랭크 최근 게임 상대 이름', () => {
  it('물약을 안 쓴 판은 그 판의 닉네임 스냅샷을 쓴다', () => {
    expect(rankOpponentName('log-1', 'opp', rows)).toBe('그때닉');
  });
  it('상대가 익명 물약을 쓴 판은 ??? 로 가린다', () => {
    expect(rankOpponentName('log-2', 'opp', rows)).toBe('???');
  });
  it('기록이 없어 물약 여부를 모르면 실명 대신 ??? 로 둔다', () => {
    expect(rankOpponentName(null, 'opp', rows)).toBe('???');
    expect(rankOpponentName('log-9', 'opp', rows)).toBe('???');
  });
  it('내가 물약을 쓴 판이어도 상대 이름은 가리지 않는다', () => {
    const mine: MatchParticipantRow[] = [
      { game_log_id: 'log-3', member_id: 'me', nickname_snapshot: '나', anonymized: true },
      { game_log_id: 'log-3', member_id: 'opp', nickname_snapshot: '상대', anonymized: false },
    ];
    expect(rankOpponentName('log-3', 'opp', mine)).toBe('상대');
  });
});

describe('힘든 상대 집계', () => {
  it('나와의 판에서 물약을 쓴 적 있는 상대는 항목째 뺀다', () => {
    const tough = [
      { opponent_id: 'a', nickname: 'A' },
      { opponent_id: 'b', nickname: 'B' },
      { opponent_id: 'c', nickname: 'C' },
    ];
    expect(
      withoutAnonymizedOpponents(tough, [{ member_id: 'b' }, { member_id: null }]).map((r) => r.opponent_id),
    ).toEqual(['a', 'c']);
    expect(withoutAnonymizedOpponents(tough, [])).toHaveLength(3);
  });
});
