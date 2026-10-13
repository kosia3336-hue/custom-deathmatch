import { create } from 'zustand';
import type { GameRecordFile } from '@/classic-era/shared/types/archive';

interface ArchiveState {
  record: GameRecordFile | null;
  setRecord: (record: GameRecordFile | null) => void;
}

export const useArchiveStore = create<ArchiveState>((set) => ({
  record: null,
  setRecord: (record) => set({ record }),
}));
