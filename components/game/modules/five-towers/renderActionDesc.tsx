'use client';
import type { FTActionLogEntry } from '@/shared/types/five-towers';

export function renderActionDesc(e: FTActionLogEntry, myId: string): React.ReactNode {
  const isMe = e.actorId === myId;
  if (e.kind === 'stack-public') {
    return isMe ? (
      <>
        <b>{e.tower}</b>탑 +<b>{e.count}</b>칸
      </>
    ) : (
      <>
        <b>{e.tower}</b>탑에 쌓음
      </>
    );
  }
  if (e.kind === 'secret-hidden') {
    if (isMe && e.tower != null && e.count != null) {
      return (
        <>
          <span className="font-bold text-purple-700">시크릿</span> → <b>{e.tower}</b>탑 +
          <b>{e.count}</b>칸 (비공개)
        </>
      );
    }
    return (
      <>
        <span className="font-bold text-purple-700">시크릿</span> 사용
      </>
    );
  }
  if (e.kind === 'secret-revealed') {
    return (
      <>
        <span className="font-bold text-purple-700">시크릿</span> → <b>{e.tower}</b>탑 공개
        {isMe && e.count != null ? <> (+{e.count}칸)</> : null}
      </>
    );
  }
  if (e.kind === 'info-self') {
    return (
      <>
        <span className="font-bold text-sky-700">정보</span>:{' '}
        <b>
          {e.targets?.[0]}+{e.targets?.[1]}
        </b>{' '}
        = <b>{e.sum}</b>
      </>
    );
  }
  if (e.kind === 'zero-self') {
    return (
      <>
        <span className="font-bold text-slate-700">제로</span> → <b>{e.tower}</b>탑 (0칸)
      </>
    );
  }
  return null;
}
