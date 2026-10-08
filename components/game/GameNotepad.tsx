'use client';

import { useState } from 'react';

function readNote(key: string) {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

/** 개인 메모는 서버에 보내지 않고, 같은 판의 도킹/화면 전환·재접속에도 보존한다. */
export function GameNotepad({ storageKey }: { storageKey: string }) {
  const [note, setNote] = useState(() => readNote(storageKey));
  return (
    <textarea
      aria-label="일반 메모장"
      placeholder="자유롭게 메모하세요."
      value={note}
      onChange={(event) => {
        const value = event.target.value;
        setNote(value);
        try {
          window.localStorage.setItem(storageKey, value);
        } catch {
          // 저장 공간이 없더라도 현재 화면의 메모는 유지한다.
        }
      }}
      rows={6}
      className="border-cdm-border bg-cdm-bg text-cdm-fg placeholder:text-cdm-fg-subtle focus:border-cdm-primary min-h-32 w-full resize-y rounded-md border px-3 py-2 text-[16px] leading-relaxed outline-none lg:text-sm"
    />
  );
}
