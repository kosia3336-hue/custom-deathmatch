'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { TextInput } from '@/components/cdm/TextInput';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { callRpc } from '@/lib/supabase/rpc';
import type { TitleColor } from '@/lib/supabase/database.types';

const COLORS: TitleColor[] = [
  'coral', 'amber', 'emerald', 'sky', 'violet', 'pink',
  'lime', 'rose', 'cyan', 'orange', 'fuchsia', 'teal',
  'yellow', 'indigo', 'slate', 'gold',
];

export default function CreateTitleForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TitleColor>('indigo');
  const [description, setDescription] = useState('');
  const [busy, startTransition] = useTransition();

  function go() {
    if (name.trim().length < 1 || name.trim().length > 12) {
      toast.error('칭호 이름은 1~12자');
      return;
    }
    if (!description.trim()) {
      toast.error('설명을 입력해주세요 (유저에게 공개됩니다)');
      return;
    }
    startTransition(async () => {
      try {
        const sb = getBrowserSupabase();
        await callRpc(sb, 'admin_create_title', {
          p_name: name.trim(),
          p_color: color,
          p_description: description.trim(),
        });
        toast.success('칭호가 생성되었습니다');
        setName('');
        setDescription('');
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <TextInput
        label="이름 (1~12자)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={12}
        placeholder="예) 흑과백2 왕"
      />
      <div>
        <label className="mb-1 block text-sm font-medium text-cdm-fg">색</label>
        <div className="flex flex-wrap gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={
                color === c
                  ? 'rounded-full ring-2 ring-cdm-primary ring-offset-2'
                  : ''
              }
            >
              <TitleBadge name={c} color={c} size="sm" />
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-cdm-fg">
          설명 <span className="text-cdm-fg-subtle text-xs">(필수 · 유저에게 공개)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="예) 2026-05월 흑과백2 랭킹 1등 달성"
          className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
        />
      </div>
      <div className="flex justify-between items-center gap-3">
        <span className="text-sm text-cdm-fg-muted">미리보기:</span>
        {name.trim() && <TitleBadge name={name.trim()} color={color} size="md" />}
        <Button onClick={go} loading={busy}>생성</Button>
      </div>
    </div>
  );
}
