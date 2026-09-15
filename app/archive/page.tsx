'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import GNB from '@/components/layout/GNB';
import { useArchiveStore } from '@/stores/archive';
import type { GameRecordFile } from '@/shared/types/archive';
import { GAME_IDS } from '@/shared/types';

const SUPPORTED_GAMES = new Set<string>([
  GAME_IDS.FOUR_GRAVITY,
  GAME_IDS.DOUBLE_SIDED_CHESS,
  GAME_IDS.NUMBER_FOUR,
  GAME_IDS.INDIAN_POKER,
  GAME_IDS.INVEST_DONATE,
  GAME_IDS.BETTING_RPS,
  GAME_IDS.MULTIPLE_BNW,
  GAME_IDS.BNW2,
  GAME_IDS.WINNING_STREAK,
  GAME_IDS.SILPER_BNW,
  GAME_IDS.FIVE_TOWERS,
  GAME_IDS.GRAPE_SUGAR_2,
  GAME_IDS.SUN_MOON_STAR_2,
  GAME_IDS.BANK_GAME,
  GAME_IDS.FORMULA_COMPLETION,
  GAME_IDS.COMPLETE_HAP,
  GAME_IDS.KNIGHTS_TOUR,
  GAME_IDS.KINGMAKING,
  GAME_IDS.TRIPLE_GOMOKU,
  GAME_IDS.CHOICE_HOLDEM,
  GAME_IDS.SEED_SEOTDA,
  GAME_IDS.DOUBLE_SIDED_POKER,
  GAME_IDS.MYEONGCHURI,
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

function validateRecord(data: unknown): data is GameRecordFile {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  if (
    typeof obj.version !== 'string' ||
    typeof obj.gameId !== 'string' ||
    typeof obj.gameName !== 'string' ||
    typeof obj.playedAt !== 'string' ||
    typeof obj.playMode !== 'string' ||
    obj.gameRecord == null ||
    typeof obj.gameRecord !== 'object'
  )
    return false;

  if (!obj.result || typeof obj.result !== 'object') return false;
  const result = obj.result as Record<string, unknown>;
  if (!Array.isArray(result.rankings) || typeof result.playTime !== 'number') return false;

  return true;
}

export default function ArchivePage() {
  const router = useRouter();
  const setRecord = useArchiveStore((s) => s.setRecord);
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback(
    (file: File) => {
      if (!file.name.endsWith('.json')) {
        toast.error('JSON 파일만 업로드할 수 있습니다.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error('파일이 너무 큽니다 (최대 5MB).');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);

          if (!validateRecord(data)) {
            toast.error('기록 파일 형식이 올바르지 않습니다.');
            return;
          }

          if (!SUPPORTED_GAMES.has(data.gameId)) {
            toast.error('지원하지 않는 게임입니다.');
            return;
          }

          setRecord(data);
          router.push('/archive/view');
        } catch {
          toast.error('올바른 JSON 파일이 아닙니다.');
        }
      };
      reader.readAsText(file);
    },
    [setRecord, router],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.target.value = '';
    },
    [processFile],
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <GNB />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center p-6">
        <h1 className="mb-8 text-2xl font-bold text-gray-900">기록실</h1>

        <label
          htmlFor="archive-file-input"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors sm:p-12 ${
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
          }`}
        >
          <p className="mb-1 text-base font-medium text-gray-700">
            {dragging ? '놓으세요!' : '기록 파일을 올려주세요'}
          </p>
          <p className="text-sm text-gray-500">파일을 드래그하거나 탭하여 선택하세요</p>
          <p className="mt-2 text-xs text-gray-400">.json (최대 5MB)</p>
        </label>

        <input
          id="archive-file-input"
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="mt-6 w-full rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          기록 파일은 게임 결과 화면에서{' '}
          <span className="font-medium text-gray-700">[기록 저장]</span> 버튼을 눌러 다운로드할 수
          있습니다.
        </div>
      </main>
    </div>
  );
}
