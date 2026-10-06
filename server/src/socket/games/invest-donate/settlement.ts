import type { InternalState, InternalRoundRecord, RoundActionLog } from './types.js';
import { judgeInvest, judgeDonate, coinValue, coinAdd, coinSubtract } from './judge.js';

/** Deduct spent coins, award scores and append exactly one public record/log. */
export function settleRound(s: InternalState) {
  const p1 = s.player1;
  const p2 = s.player2;

  const investResult = judgeInvest(p1.id, p1.investCoins!, p2.id, p2.investCoins!);
  const donateResult = judgeDonate(p1.id, p1.donateCoins!, p2.id, p2.donateCoins!);

  const totalChange: Record<string, number> = {};
  for (const id of [p1.id, p2.id]) {
    totalChange[id] = investResult.scoreChanges[id] + donateResult.scoreChanges[id];
  }

  const p1ScoreBefore = p1.score;
  const p2ScoreBefore = p2.score;

  p1.score = Math.max(0, p1.score + totalChange[p1.id]);
  p2.score = Math.max(0, p2.score + totalChange[p2.id]);

  for (const player of [p1, p2]) {
    const used = coinAdd(player.investCoins!, player.donateCoins!);
    player.coinStock = coinSubtract(player.coinStock, used);
  }

  for (const player of [p1, p2]) {
    player.investBadge = investResult.badge[player.id] ?? null;
    player.donateBadge = donateResult.badge[player.id] ?? null;
  }

  const roundRecord: InternalRoundRecord = {
    round: s.round,
    players: {},
  };
  for (const id of [p1.id, p2.id]) {
    const player = id === p1.id ? p1 : p2;
    roundRecord.players[id] = {
      investCoins: player.investCoins!,
      donateCoins: player.donateCoins!,
      investTotal: coinValue(player.investCoins!),
      donateTotal: coinValue(player.donateCoins!),
      investBadge: investResult.badge[id] ?? null,
      donateBadge: donateResult.badge[id] ?? null,
      scoreChange: totalChange[id],
      scoreAfter: player.score,
      coinStockAfter: { ...player.coinStock },
    };
  }
  s.roundHistory.push(roundRecord);

  const actionLog: RoundActionLog = {
    round: s.round,
    players: {},
  };
  for (const id of [p1.id, p2.id]) {
    const player = id === p1.id ? p1 : p2;
    const scoreBefore = id === p1.id ? p1ScoreBefore : p2ScoreBefore;
    actionLog.players[id] = {
      nickname: player.nickname,
      investCoins: player.investCoins!,
      donateCoins: player.donateCoins!,
      investTotal: coinValue(player.investCoins!),
      donateTotal: coinValue(player.donateCoins!),
      investBadge: investResult.badge[id] ?? null,
      donateBadge: donateResult.badge[id] ?? null,
      scoreChange: totalChange[id],
      scoreBefore,
      scoreAfter: player.score,
      coinStockAfter: { ...player.coinStock },
    };
  }
  s.actionLog.push(actionLog);
}
