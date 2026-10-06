import { gameStates } from './store.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from './constants.js';
import type { InternalState } from './types.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import { buildGameDataForPlayer, buildGameState } from './projection.js';

export async function broadcastState(io: IO, s: InternalState) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  if (gameStates.get(s.roomId) !== s) return;
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    const gameData = buildGameDataForPlayer(s, pid);
    const p1 = s.players[s.player1Id];
    const p2 = s.players[s.player2Id];
    if (p1 && p2 && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
      const self = s.players[pid];
      if (self && s.phase === 'betting' && self.card != null) {
        sock.emit('ext:data', {
          game: 'indian-poker',
          round: s.round,
          type: 'ownCard',
          card: self.card,
        });
      } else if (s.phase === 'showdown' && s.showdownData) {
        sock.emit('ext:data', {
          game: 'indian-poker',
          round: s.round,
          type: 'showdown',
          showdownData: s.showdownData,
        });
      } else if (s.phase === 'dieResult' && s.dieData) {
        sock.emit('ext:data', {
          game: 'indian-poker',
          round: s.round,
          type: 'dieResult',
          dieData: s.dieData,
        });
      }
    }
    sock.emit('game:state', buildGameState(s, gameData, pid));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const gameData = buildGameDataForPlayer(s, pid);
  const p1 = s.players[s.player1Id];
  const p2 = s.players[s.player2Id];
  if (p1 && p2 && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
    const self = s.players[pid];
    if (self && s.phase === 'betting' && self.card != null) {
      socket.emit('ext:data', {
        game: 'indian-poker',
        round: s.round,
        type: 'ownCard',
        card: self.card,
      });
    } else if (s.phase === 'showdown' && s.showdownData) {
      socket.emit('ext:data', {
        game: 'indian-poker',
        round: s.round,
        type: 'showdown',
        showdownData: s.showdownData,
      });
    } else if (s.phase === 'dieResult' && s.dieData) {
      socket.emit('ext:data', {
        game: 'indian-poker',
        round: s.round,
        type: 'dieResult',
        dieData: s.dieData,
      });
    }
  }
  socket.emit('game:state', buildGameState(s, gameData, pid));
}
