import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ADJECTIVES = ['빠른', '용감한', '영리한', '멋진', '신비한', '대담한', '활발한', '강한'];
const NOUNS = ['호랑이', '독수리', '여우', '늑대', '사자', '판다', '드래곤', '피닉스'];

export function generateRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

/** 밀리초(ms)를 M:SS 형태로 포맷합니다. 예) 75000 → "1:15" */
export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** 초(s)를 "X분 Y초" 형태로 포맷합니다. 예) 75 → "1분 15초" */
export function formatTimeLimit(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}분 ${sec.toString().padStart(2, '0')}초`;
}

/** 초(s)를 짧은 형태로 포맷합니다. 예) 75 → "1:15", 30 → "30초" */
export function formatTimeLimitShort(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}초`;
  if (sec === 0) return `${min}분`;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}
