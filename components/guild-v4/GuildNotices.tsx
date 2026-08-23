'use client';

import { useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { MarkdownWysiwyg } from '@/components/admin/MarkdownWysiwyg';
import { MarkdownView } from '@/lib/markdown';
import type { MyGuildState } from '@/lib/guild/types';
import { useGuildDevStore, useGuildDevStoreApi } from './store';
import type { DevGuildNotice } from './dummy';
import { GuildConfirmModal, type GuildConfirm } from './GuildConfirmModal';
import {
  DEV_NOTICE_BODY_MAX,
  DEV_NOTICE_COMMENT_MAX,
  DEV_NOTICE_TITLE_MAX,
  DEV_NOTICE_TITLE_MIN,
} from './limits';

type Act = (payload: Record<string, unknown>, successMsg?: string) => Promise<boolean>;

function canWriteNotice(role: MyGuildState['role']) {
  return role === 'owner' || role === 'vice_owner';
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GuildNoticeSection({
  my,
  busy,
  act,
}: {
  my: MyGuildState;
  busy: boolean;
  act: Act;
}) {
  const notices = useGuildDevStore((s) => s.notices);
  const [view, setView] = useState<'list' | 'write' | { detail: string } | { edit: string }>('list');
  const [pending, setPending] = useState<GuildConfirm | null>(null);
  const canWrite = canWriteNotice(my.role);

  if (view === 'write' || (typeof view === 'object' && 'edit' in view)) {
    const editing =
      typeof view === 'object' && 'edit' in view
        ? notices.find((n) => n.id === view.edit)
        : undefined;
    return (
      <NoticeWriteForm
        busy={busy}
        act={act}
        initial={editing}
        onBack={() => setView(editing ? { detail: editing.id } : 'list')}
        onPosted={(id) => setView({ detail: id })}
      />
    );
  }

  if (typeof view === 'object') {
    const notice = notices.find((n) => n.id === view.detail);
    if (!notice) {
      return (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="cursor-pointer self-start text-sm font-medium text-cdm-primary hover:underline"
            onClick={() => setView('list')}
          >
            ← 공지
          </button>
          <p className="py-6 text-center text-sm text-cdm-fg-muted">공지를 찾을 수 없습니다.</p>
        </div>
      );
    }
    return (
      <>
        <NoticeDetail
          notice={notice}
          busy={busy}
          act={act}
          canWrite={canWrite}
          onBack={() => setView('list')}
          onEdit={() => setView({ edit: notice.id })}
          onDelete={() =>
            setPending({
              title: '공지 삭제',
              message: '이 공지를 삭제하시겠습니까?',
              confirmLabel: '삭제',
              variant: 'danger',
              run: async () => {
                const ok = await act({ action: 'delete_notice', noticeId: notice.id }, '공지를 삭제했습니다.');
                if (ok) setView('list');
                return ok;
              },
            })
          }
        />
        <GuildConfirmModal pending={pending} busy={busy} onClose={() => setPending(null)} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {canWrite && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setView('write')} disabled={busy}>
            작성
          </Button>
        </div>
      )}
      {notices.length === 0 ? (
        <p className="py-8 text-center text-sm text-cdm-fg-muted">공지가 없습니다.</p>
      ) : (
        <ul className="flex flex-col">
          {notices.map((n) => (
            <li key={n.id} className="border-b border-cdm-border last:border-0">
              <button
                type="button"
                className="flex w-full cursor-pointer flex-col gap-0.5 py-3 text-left"
                onClick={() => setView({ detail: n.id })}
              >
                <span className="text-sm font-medium text-cdm-fg">{n.title}</span>
                <span className="text-[11px] text-cdm-fg-muted">
                  {n.authorNickname} · {formatWhen(n.createdAt)} · 댓글 {n.comments.length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoticeWriteForm({
  busy,
  act,
  initial,
  onBack,
  onPosted,
}: {
  busy: boolean;
  act: Act;
  initial?: DevGuildNotice;
  onBack: () => void;
  onPosted: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const titleLen = title.length;
  const bodyLen = body.length;
  const editing = Boolean(initial);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="cursor-pointer self-start text-sm font-medium text-cdm-primary hover:underline"
        onClick={onBack}
      >
        ← 공지
      </button>
      <TextInput
        label={`제목 (2~80자, ${titleLen}/80)`}
        value={title}
        onChange={(e) => setTitle(e.target.value.slice(0, DEV_NOTICE_TITLE_MAX))}
        maxLength={DEV_NOTICE_TITLE_MAX}
        disabled={busy}
        error={
          titleLen > 0 && titleLen < DEV_NOTICE_TITLE_MIN
            ? '제목은 2자 이상이어야 합니다'
            : titleLen > DEV_NOTICE_TITLE_MAX
              ? '제목이 너무 깁니다'
              : null
        }
      />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">
          본문 ({bodyLen.toLocaleString()} / 10,000자)
        </label>
        <MarkdownWysiwyg
          value={body}
          onChange={setBody}
          resetKey={initial?.id ?? 'create'}
          minHeightClass="min-h-[200px]"
        />
      </div>
      <Button
        disabled={
          busy ||
          title.trim().length < DEV_NOTICE_TITLE_MIN ||
          body.length < 1 ||
          body.length > DEV_NOTICE_BODY_MAX
        }
        onClick={async () => {
          const ok = editing
            ? await act(
                { action: 'update_notice', noticeId: initial!.id, title, body },
                '공지를 수정했습니다.',
              )
            : await act({ action: 'post_notice', title, body }, '공지를 올렸습니다.');
          if (!ok) return;
          if (editing) {
            onPosted(initial!.id);
            return;
          }
          const latest = useGuildDevStoreApi().getState().notices[0];
          if (latest) onPosted(latest.id);
        }}
      >
        {editing ? '공지 수정' : '공지 등록'}
      </Button>
    </div>
  );
}

function NoticeDetail({
  notice,
  busy,
  act,
  canWrite,
  onBack,
  onEdit,
  onDelete,
}: {
  notice: DevGuildNotice;
  busy: boolean;
  act: Act;
  canWrite: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [comment, setComment] = useState('');

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="cursor-pointer self-start text-sm font-medium text-cdm-primary hover:underline"
        onClick={onBack}
      >
        ← 공지
      </button>
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-cdm-fg">{notice.title}</h3>
          {canWrite ? (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="secondary" disabled={busy} onClick={onEdit}>
                수정
              </Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={onDelete}>
                삭제
              </Button>
            </div>
          ) : null}
        </div>
        <p className="mt-0.5 text-[11px] text-cdm-fg-muted">
          {notice.authorNickname} · {formatWhen(notice.createdAt)}
          {notice.updatedAt ? ` · 수정 ${formatWhen(notice.updatedAt)}` : ''}
        </p>
        <div className="mt-3">
          <MarkdownView source={notice.body} />
        </div>
      </div>
      <div className="border-t border-cdm-border pt-3">
        <p className="mb-2 text-xs font-semibold text-cdm-fg">댓글 {notice.comments.length}</p>
        {notice.comments.length === 0 ? (
          <p className="mb-3 text-sm text-cdm-fg-muted">댓글이 없습니다.</p>
        ) : (
          <ul className="mb-3 flex flex-col">
            {notice.comments.map((c) => (
              <li key={c.id} className="border-b border-cdm-border py-2 last:border-0">
                <p className="text-[11px] text-cdm-fg-muted">
                  {c.authorNickname} · {formatWhen(c.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-cdm-fg">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form
          className="flex flex-col gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await act(
              { action: 'comment_notice', noticeId: notice.id, body: comment },
              '댓글을 달았습니다.',
            );
            if (ok) setComment('');
          }}
        >
          <textarea
            className="w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm text-cdm-fg"
            rows={2}
            maxLength={DEV_NOTICE_COMMENT_MAX}
            placeholder="댓글을 입력하세요"
            value={comment}
            disabled={busy}
            onChange={(e) => setComment(e.target.value.slice(0, DEV_NOTICE_COMMENT_MAX))}
          />
          <div className="flex items-center gap-2">
            <span className="mr-auto text-[11px] tabular-nums text-cdm-fg-subtle">
              {comment.length}/{DEV_NOTICE_COMMENT_MAX}
            </span>
            <Button type="submit" size="sm" disabled={busy || !comment.trim()}>
              댓글
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
