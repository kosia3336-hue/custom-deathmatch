import type { DummyAiTier } from '@shared/dummy.js';
import { GAME_IDS } from '@shared/types/game.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { createDevDummyMatch } from './match.js';

const TIERS: ReadonlySet<string> = new Set(['상', '중', '하']);
const SKIP_GAMES: ReadonlySet<string> = new Set([
  GAME_IDS.FOUR_GRAVITY,
  GAME_IDS.DOUBLE_SIDED_CHESS,
  GAME_IDS.NUMBER_FOUR,
  GAME_IDS.INDIAN_POKER,
  GAME_IDS.INVEST_DONATE,
  GAME_IDS.BETTING_RPS,
  GAME_IDS.MULTIPLE_BNW,
  GAME_IDS.WINNING_STREAK,
  GAME_IDS.BNW2,
  GAME_IDS.SILPER_BNW,
  GAME_IDS.FIVE_TOWERS,
  GAME_IDS.GRAPE_SUGAR_2,
  GAME_IDS.SUN_MOON_STAR_2,
  GAME_IDS.BANK_GAME,
  GAME_IDS.QUATRO,
]);


export function registerDevDummyHandlers(io: IO, socket: TypedSocket): void {
  socket.on('dev:rankDummy:start', (data, callback) => {
    if (typeof callback !== 'function') return;

    const tier = data?.tier;
    if (!TIERS.has(tier)) {
      callback({ success: false, error: '등급은 상·중·하 중 하나여야 합니다.' });
      return;
    }

    const skipGameId =
      typeof data?.skipGameId === 'string' && data.skipGameId
        ? data.skipGameId
        : data?.skipBanPick === true
          ? GAME_IDS.FOUR_GRAVITY
          : undefined;

    if (skipGameId && !SKIP_GAMES.has(skipGameId)) {
      callback({ success: false, error: '바로 시작할 수 있는 게임은 사목·양면장기·넘버4·인디언홀덤Q·투자와기부·베팅가위바위보·배수흑과백·연승게임·흑과백2·실퍼의흑과백·5개의탑·포도설탕2·해달별2·은행놀이·콰트로뿐입니다.' });
      return;
    }


    const result = createDevDummyMatch(io, socket, {
      tier: tier as DummyAiTier,
      skipGameId,
    });

    if (!result.ok) {
      callback({ success: false, error: result.error });
      return;
    }
    callback({ success: true, roomId: result.roomId });
  });
}
