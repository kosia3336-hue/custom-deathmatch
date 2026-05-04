'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { InquiryCategory } from '@/lib/supabase/database.types';

const CATEGORIES: { id: InquiryCategory; label: string }[] = [
  { id: 'bug', label: '버그/오류' },
  { id: 'account', label: '계정/정지' },
  { id: 'rules', label: '규칙/정책' },
  { id: 'report_followup', label: '신고 처리 문의' },
  { id: 'etc', label: '기타' },
];

export default function InquiryForm({ reasonTag }: { reasonTag: string | null }) {
  const router = useRouter();
  const [category, setCategory] = useState<InquiryCategory>(
    reasonTag === 'suspension' || reasonTag === 'ban' ? 'account' : 'etc',
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, startTransition] = useTransition();

  function submit() {
    const t = title.trim();
    const b = body.trim();
    if (t.length < 5) {
      toast.error('제목은 5자 이상 입력해 주세요');
      return;
    }
    if (b.length < 10) {
      toast.error('본문은 10자 이상 입력해 주세요');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'submit_inquiry', {
          p_category: category,
          p_title: t,
          p_body: b,
          p_attachments: [],
          p_reason_tag: reasonTag ?? undefined,
        });
        fetch('/api/hidden-titles/check-inquiry', { method: 'POST' }).catch(() => {});
        toast.success('문의가 접수되었습니다');
        router.push('/me?tab=support');
      } catch (e) {
        toast.error(`접수 실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">분류</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as InquiryCategory)}
          className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <TextInput
        label="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="간단한 제목 (5~50자)"
        maxLength={50}
      />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">본문</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="자세한 상황을 알려주세요. (10~1000자)"
          rows={6}
          maxLength={1000}
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary focus:[box-shadow:var(--cdm-ring-primary)]"
        />
        <p className="text-xs text-cdm-fg-muted">{body.length} / 1000</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} loading={busy}>
          접수하기
        </Button>
      </div>
    </div>
  );
}
