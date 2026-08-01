'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { NoticeCategoryChip, NOTICE_CATEGORIES } from '@/components/cdm/NoticeCategoryChip';
import { MarkdownWysiwyg } from '@/components/admin/MarkdownWysiwyg';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { NoticeCategory } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';

interface InitialValues {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  isPinned: boolean;
  isPublished: boolean;
}

interface NoticeFormProps {
  mode: 'create' | 'edit';
  initial?: InitialValues;
  /** 저장 성공 후 이동할 href. 없으면 router.refresh() 만 수행 */
  afterSaveHref?: string;
  onDone?: () => void;
  onCancel?: () => void;
}

async function notifyNoticePublished(noticeId: string, title: string, category: string) {
  try {
    await fetch('/api/admin/notify-notice-published', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noticeId, title, category }),
    });
  } catch {
    // 소켓 서버 다운 등 — 무시
  }
}

export default function NoticeForm({ mode, initial, afterSaveHref, onDone, onCancel }: NoticeFormProps) {  const router = useRouter();
  const [title, setTitle] = React.useState(initial?.title ?? '');
  const [body, setBody] = React.useState(initial?.body ?? '');
  const [category, setCategory] = React.useState<NoticeCategory>(
    initial?.category ?? 'general',
  );
  const [isPinned, setIsPinned] = React.useState(initial?.isPinned ?? false);
  const [isPublished, setIsPublished] = React.useState(initial?.isPublished ?? true);
  const [busy, startTransition] = React.useTransition();

  function reset() {
    setTitle('');
    setBody('');
    setCategory('general');
    setIsPinned(false);
    setIsPublished(true);
  }

  function go() {
    const tt = title.trim();
    if (tt.length < 2 || tt.length > 80) {
      toast.error('제목은 2~80자');
      return;
    }
    if (body.length < 1 || body.length > 10_000) {
      toast.error('본문은 1자 이상, 10,000자 이하');
      return;
    }

    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        if (mode === 'create') {
          const noticeId = await callRpc(sb, 'admin_create_notice', {
            p_title: tt,
            p_body: body,
            p_category: category,
            p_is_pinned: isPinned,
            p_is_published: isPublished,
          });
          toast.success('공지가 등록되었습니다');
          // 공개 발행된 경우 실시간 알림 전송
          if (isPublished && noticeId) {
            void notifyNoticePublished(noticeId, tt, category);
          }
          reset();
        } else if (initial) {
          // 1) 본문/제목/카테고리 변경
          await callRpc(sb, 'admin_update_notice', {
            p_id: initial.id,
            p_title: tt,
            p_body: body,
            p_category: category,
          });
          // 2) 핀 토글이 바뀐 경우만 추가 호출
          if (isPinned !== initial.isPinned) {
            await callRpc(sb, 'admin_toggle_notice_pin', {
              p_id: initial.id,
              p_pinned: isPinned,
            });
          }
          // 3) 공개 토글이 바뀐 경우만 추가 호출
          if (isPublished !== initial.isPublished) {
            await callRpc(sb, 'admin_set_notice_published', {
              p_id: initial.id,
              p_published: isPublished,
            });
            // 비공개 → 공개 전환 시 실시간 알림 전송
            if (isPublished) {
              void notifyNoticePublished(initial.id, tt, category);
            }
          }
          toast.success('공지가 수정되었습니다');
        }
        if (afterSaveHref) {
          router.push(afterSaveHref);
        } else {
          router.refresh();
        }
        onDone?.();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  const titleLen = title.length;
  const bodyLen = body.length;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-cdm-fg">카테고리</label>
        <div className="flex flex-wrap gap-1.5">
          {NOTICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={cn(
                'rounded-full transition-all',
                category === cat
                  ? 'ring-2 ring-cdm-primary ring-offset-2'
                  : 'opacity-60 hover:opacity-100',
              )}
            >
              <NoticeCategoryChip category={cat} size="md" />
            </button>
          ))}
        </div>
      </div>

      <TextInput
        label={`제목 (2~80자, ${titleLen}/80)`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={80}
        placeholder="예) 5월 정기 점검 안내"
        error={
          titleLen > 0 && titleLen < 2
            ? '제목은 2자 이상이어야 합니다'
            : titleLen > 80
              ? '제목이 너무 깁니다'
              : null
        }
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">
          본문 ({bodyLen.toLocaleString()} / 10,000자)
          <span className="ml-2 text-xs font-normal text-cdm-fg-subtle">
            보이는 그대로 저장됩니다 — 툴바 또는 Ctrl+B/I 단축키 사용
          </span>
        </label>
        <MarkdownWysiwyg
          value={body}
          onChange={setBody}
          resetKey={initial?.id ?? mode}
          minHeightClass="min-h-[280px]"
          uploadEndpoint="/api/admin/game-rules/upload"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-cdm-fg">
          <input
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="h-4 w-4 accent-cdm-primary"
          />
          상단 고정
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-cdm-fg">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="h-4 w-4 accent-cdm-primary"
          />
          공개
          <span className="text-xs text-cdm-fg-subtle">
            (해제 시 사용자에게 노출되지 않음)
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            취소
          </Button>
        )}
        <Button onClick={go} loading={busy}>
          {mode === 'create' ? '공지 등록' : '저장'}
        </Button>
      </div>
    </div>
  );
}
