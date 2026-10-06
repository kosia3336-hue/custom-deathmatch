import type { NumberFourAction, NumberFourGameData, NF4Number } from './types/number4';
import { judgeNumber } from './numberFourJudge';

export const NUMBER_FOUR_LESSONS = [
  {
    white: 4,
    number: 1,
    opponentWhite: 3,
    opponentNumber: 1,
    body: '백색 4개와 넘버 1을 선택하세요. 내 백색이 상대 백색 이상이면 +1점입니다.',
  },
  {
    white: 3,
    number: 2,
    opponentWhite: 1,
    opponentNumber: 2,
    body: '백색 3개와 넘버 2를 선택하세요. 내 백색×흑색이 상대보다 커야 +2점입니다. 같으면 실패합니다.',
  },
  {
    white: 6,
    number: 3,
    opponentWhite: 6,
    opponentNumber: 1,
    body: '백색 6개와 넘버 3을 선택하세요. 내 백색이 상대 흑색+2 이상이면 +3점입니다.',
  },
  {
    white: 4,
    number: 4,
    opponentWhite: 5,
    opponentNumber: 1,
    body: '백색 4개와 넘버 4를 선택하세요. 내 백색이 상대 흑색의 2배 이상이면 +4점입니다.',
  },
  {
    white: 1,
    number: 0,
    opponentWhite: 1,
    opponentNumber: 0,
    body: '백색 1개와 넘버 0을 선택하세요. 두 사람의 흑색 합계가 11개 이상이면 +5점입니다.',
  },
  {
    white: 4,
    number: 0,
    opponentWhite: 6,
    opponentNumber: 1,
    body: '남은 백색 4개와 넘버 0을 선택하세요. 이번에는 흑색 합계가 부족해 실패합니다. 실패하면 1점이 줄어듭니다.',
  },
] as const;

export function createNumberFourTutorial(id: string, nickname: string): NumberFourGameData {
  const player = (pid: string, name: string) => ({
    id: pid,
    nickname: name,
    score: 3,
    remainingWhite: 22,
    remainingBlack: 20,
    submitted: false,
  });
  return {
    round: 1,
    phase: 'submit',
    players: { [id]: player(id, nickname), tutorial_guide: player('tutorial_guide', '연습 상대') },
    revealData: null,
    roundHistory: [],
    winner: null,
    winType: null,
    tiebreakerReason: null,
    currentSide: null,
    tutorial: {
      step: 'intro',
      title: '넘버 4 튜토리얼',
      body: '3점으로 시작합니다. 매 라운드 타일 7개와 넘버 하나를 함께 제출합니다. 6라운드 뒤 높은 점수가 승리하며, 0점이 되면 탈락합니다. 상대의 타일 수는 실제 게임에서 공개되지 않습니다.',
      ackLabel: '시작하기',
    },
  };
}

/** 서버와 로컬 dev 화면이 공유하는 학습 흐름. 결과는 확인하기 전까지 유지한다. */
export function advanceNumberFourTutorial(
  state: NumberFourGameData,
  action: NumberFourAction,
): { data: NumberFourGameData; error?: string; complete?: boolean } {
  const hint = state.tutorial;
  if (!hint || state.phase === 'finished')
    return { data: state, error: '진행 중인 튜토리얼이 없습니다.' };
  const data: NumberFourGameData = structuredClone(state);
  const me = Object.values(data.players).find((p) => p.id !== 'tutorial_guide')!;
  const opp = data.players.tutorial_guide;
  if (action.type === 'tutorial-ack') {
    if (hint.step === 'choose') return { data: state, error: '타일과 넘버를 먼저 제출해 주세요.' };
    if (hint.step === 'summary') {
      data.phase = 'finished';
      return { data, complete: true };
    }
    if (hint.step === 'result' && data.round === 6) {
      data.tutorial = {
        step: 'summary',
        title: '튜토리얼 완료',
        body: '점수가 같으면 선택한 넘버의 합이 낮은 쪽, 그마저 같으면 남은 백색이 많은 쪽이 승리합니다. 아래 타일 추리에서 상대의 잔여 타일을 직접 메모할 수 있습니다.',
        ackLabel: '마치기',
      };
      return { data };
    }
    if (hint.step === 'result') data.round++;
    const lesson = NUMBER_FOUR_LESSONS[data.round - 1];
    data.phase = 'submit';
    data.revealData = null;
    me.submitted = false;
    opp.submitted = false;
    delete me.submission;
    data.tutorial = {
      step: 'choose',
      title: `넘버 ${lesson.number} 익히기 (${data.round}/6)`,
      body: lesson.body,
      expectedWhite: lesson.white,
      expectedNumber: lesson.number,
    };
    return { data };
  }
  const lesson = NUMBER_FOUR_LESSONS[data.round - 1];
  if (
    hint.step !== 'choose' ||
    action.white !== lesson.white ||
    action.black !== 7 - lesson.white ||
    action.number !== lesson.number
  ) {
    return {
      data: state,
      error: `백색 ${lesson.white}개, 흑색 ${7 - lesson.white}개와 넘버 ${lesson.number}를 선택해 주세요.`,
    };
  }
  const mine = judgeNumber(
    action.white,
    action.black,
    lesson.opponentWhite,
    7 - lesson.opponentWhite,
    action.number,
  );
  const theirs = judgeNumber(
    lesson.opponentWhite,
    7 - lesson.opponentWhite,
    action.white,
    action.black,
    lesson.opponentNumber as NF4Number,
  );
  me.remainingWhite -= action.white;
  me.remainingBlack -= action.black;
  opp.remainingWhite -= lesson.opponentWhite;
  opp.remainingBlack -= 7 - lesson.opponentWhite;
  me.score = Math.max(0, me.score + mine.scoreChange);
  opp.score = Math.max(0, opp.score + theirs.scoreChange);
  me.submitted = true;
  me.submission = { white: action.white, black: action.black, number: action.number };
  opp.submitted = true;
  data.phase = 'reveal';
  data.revealData = {
    players: {
      [me.id]: { number: action.number, ...mine },
      [opp.id]: { number: lesson.opponentNumber, ...theirs },
    },
  };
  data.roundHistory.push({
    round: data.round,
    players: {
      [me.id]: {
        number: action.number,
        ...mine,
        scoreAfter: me.score,
        white: action.white,
        black: action.black,
      },
      [opp.id]: { number: lesson.opponentNumber, ...theirs, scoreAfter: opp.score },
    },
  });
  data.tutorial = {
    step: 'result',
    title: mine.success ? '조건 성공' : '조건 실패',
    body: `내 타일: 백 ${action.white} / 흑 ${action.black}. 상대: 백 ${lesson.opponentWhite} / 흑 ${7 - lesson.opponentWhite}. ${mine.conditionDetail}. ${mine.scoreChange > 0 ? '+' : ''}${mine.scoreChange}점입니다. 실제 게임에서는 넘버와 성공 여부만 공개됩니다.`,
    ackLabel: data.round === 6 ? '정리하기' : '다음 라운드',
  };
  return { data };
}
