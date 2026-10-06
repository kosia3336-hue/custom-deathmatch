import type { InternalState } from './types.js';
import type { IO, TypedSocket } from './constants.js';
import { gameStates } from './store.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import {
  buildGameDataForPlayer,
  buildSpectatorGameData,
  buildGameState,
  isRevealPhase,
} from './projection.js';

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  if (gameStates.get(s.roomId) !== s) return;
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const isPlayer = pid === s.player1.id || pid === s.player2.id;
    const gameData = isPlayer ? buildGameDataForPlayer(s, pid) : buildSpectatorGameData(s);
    if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
      const opp = pid === s.player1.id ? s.player2 : s.player1;
      if (isRevealPhase(s)) {
        const last = s.actionLog[s.actionLog.length - 1];
        const d = last?.players[opp.id];
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        if (d)
          sock.emit('ext:data', {
            game: 'betting-rps',
            round: last!.round,
            opponent: oppNick,
            role: d.role,
            matchResult: d.matchResult,
            prediction: d.prediction,
            betChips: d.betChips,
          });
      } else if (s.phase === 'submit' && opp.submitted) {
        const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
        sock.emit('ext:data', {
          game: 'betting-rps',
          round: s.round,
          opponent: oppNick,
          role: opp.role,
          matchResult: opp.matchResult,
          prediction: opp.prediction,
          betChips: opp.betChips,
        });
      }
    }
    sock.emit('game:state', buildGameState(s, gameData));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = pid === s.player1.id || pid === s.player2.id;
  const gameData = isPlayer ? buildGameDataForPlayer(s, pid) : buildSpectatorGameData(s);
  if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
    const opp = pid === s.player1.id ? s.player2 : s.player1;
    if (isRevealPhase(s)) {
      const last = s.actionLog[s.actionLog.length - 1];
      const d = last?.players[opp.id];
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      if (d)
        socket.emit('ext:data', {
          game: 'betting-rps',
          round: last!.round,
          opponent: oppNick,
          role: d.role,
          matchResult: d.matchResult,
          prediction: d.prediction,
          betChips: d.betChips,
        });
    } else if (s.phase === 'submit' && opp.submitted) {
      const oppNick = isTokenAnonymized(s.roomId, opp.id) ? ANONYMOUS_NICKNAME : opp.nickname;
      socket.emit('ext:data', {
        game: 'betting-rps',
        round: s.round,
        opponent: oppNick,
        role: opp.role,
        matchResult: opp.matchResult,
        prediction: opp.prediction,
        betChips: opp.betChips,
      });
    }
  }
  socket.emit('game:state', buildGameState(s, gameData));
}
