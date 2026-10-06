import manifest from '../../public/audio/sfx/manifest.json';
import dreamshopManifest from '../../public/audio/skins/dreamshop/manifest.json';

export type FileSoundId = 'cardDeal' | 'cardFlip' | 'chipPlace' | 'chipRaise' | 'chipCollect'
  | 'matchPick' | 'matchReveal' | 'matchEliminate' | 'matchConfirm' | 'turn' | 'boardMove'
  | 'candyButton' | 'candyCard' | 'candyMinus' | 'meow0' | 'meow1' | 'meow2' | 'meow3' | 'meow4' | 'showdownGunshot' | 'dreamshopWin' | 'dreamshopDraw' | 'dreamshopLose' | 'dreamshopSuccess' | 'dreamshopFail' | 'dreamshopRefund';

export type FileSound = {
  id: FileSoundId; name: string; detail: string; category: string; src: string; volume: number;
  sourceUrl?: string; license?: string; original?: string;
};

export const FILE_SOUNDS: FileSound[] = [
  ...manifest as FileSound[],
  ...dreamshopManifest as FileSound[],
  { id: 'boardMove', name: '말·돌 놓기', detail: '추상전략 게임에서 서버가 확정한 수', category: 'board', src: '/audio/sfx/board/move.mp3', volume: .55 },
  { id: 'candyButton', name: '유리설탕 병 열기', detail: '설탕 + / MAX / 제출', category: 'skins', src: '/audio/skins/candy/button.mp3', volume: .5 },
  { id: 'candyCard', name: '유리설탕 카드 선택', detail: '유리잔을 부딪히는 소리', category: 'skins', src: '/audio/skins/candy/card.mp3', volume: .55 },
  { id: 'candyMinus', name: '유리설탕 병 닫기', detail: '설탕 -5 / -1', category: 'skins', src: '/audio/skins/candy/minus.mp3', volume: .5 },
  ...([0, 1, 2, 3, 4] as const).map(tile => ({ id: `meow${tile}` as FileSoundId, name: `냥냥 타일 ${tile}`, detail: '고른 타일의 고양이 울음', category: 'skins', src: `/audio/skins/meow/tile-${tile}.mp3`, volume: .55 })),
  { id: 'showdownGunshot', name: '서부극 발사', detail: '제출 확정 시 총성', category: 'skins', src: '/audio/skins/showdown/gunshot.mp3', volume: 1 },
];

export const FILE_SOUND_BY_ID = Object.fromEntries(FILE_SOUNDS.map(sample => [sample.id, sample])) as Record<FileSoundId, FileSound>;
export const CORE_SOUND_IDS: FileSoundId[] = manifest.map(sample => sample.id as FileSoundId);
