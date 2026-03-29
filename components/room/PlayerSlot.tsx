'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Player } from '@/shared/types';

interface Props {
  player?: Player;
  isMe: boolean;
  isHostView: boolean;
  colorLabel?: '흑' | '백';
  onKick?: (id: string) => void;
  onDelegate?: (id: string) => void;
}

export default function PlayerSlot({ player, isMe, isHostView, colorLabel, onKick, onDelegate }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!player) {
    return (
      <div className="flex h-20 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
        빈 자리
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-xl border p-4 transition-colors',
        isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-lg">
        {player.isHost ? '👑' : '😊'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{player.nickname}</span>
          {isMe && <Badge variant="info">나</Badge>}
          {player.isHost && <Badge variant="success">방장</Badge>}
          {colorLabel && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs font-bold',
              colorLabel === '흑'
                ? 'bg-gray-900 text-white'
                : 'border border-gray-300 bg-white text-gray-700',
            )}>
              {colorLabel}
            </span>
          )}
        </div>
        {!player.isHost && (
          <span className={cn('text-xs', player.isReady ? 'text-green-600' : 'text-gray-400')}>
            {player.isReady ? '준비 완료' : '준비 대기'}
          </span>
        )}
      </div>

      {isHostView && !player.isHost && !isMe && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-28 rounded-lg border border-gray-200 bg-white py-1 shadow-lg md:w-32">
                <button
                  onClick={() => { onDelegate?.(player.id); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                >
                  방장 위임
                </button>
                <button
                  onClick={() => { onKick?.(player.id); setMenuOpen(false); }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                >
                  강퇴
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
