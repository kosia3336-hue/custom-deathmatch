'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { getBrowserSupabase } from '@/lib/supabase/client';
import type { TitleColor } from '@/lib/supabase/database.types';

const COLORS: TitleColor[] = [
  'coral', 'amber', 'emerald', 'sky', 'violet', 'pink',
  'lime', 'rose', 'cyan', 'orange', 'fuchsia', 'teal',
  'yellow', 'indigo', 'slate', 'gold',
];

interface Props {
  titleId: string;
  initialName: string;
  initialColor: TitleColor;
  initialDescription: string | null;
  initialIsActive: boolean;
}

export default function TitleEditButton({
  titleId,
  initialName,
  initialColor,
  initialDescription,
  initialIsActive,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState<TitleColor>(initialColor);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [isActive, setIsActive] = useState(initialIsActive);
  const [busy, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
      setDescription(initialDescription ?? '');
      setIsActive(initialIsActive);
    }
  }, [open, initialName, initialColor, initialDescription, initialIsActive]);

  function save() {
    const n = name.trim();
    if (n.length < 1 || n.length > 12) {
      toast.error('칭호 이름은 1~12자');
      return;
    }
    startTransition(async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = getBrowserSupabase() as any;
        const { error } = await sb
          .from('titles')
          .update({ name: n, color, description: description.trim() || null, is_active: isActive })
          .eq('id', titleId);
        if (error) throw error;
        toast.success('칭호가 수정되었습니다');
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(`실패: ${(e as Error).message}`);
      }
    });
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        수정
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="칭호 수정"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              취소
            </Button>
            <Button onClick={save} loading={busy}>
              저장
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 이름 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">이름 <span className="text-xs font-normal text-cdm-fg-muted">(1~12자)</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={12}
              className="h-10 rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 text-sm text-cdm-fg outline-none focus:border-cdm-primary"
            />
          </div>

          {/* 색 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-cdm-fg">색</label>
            <div className="flex flex-wrap gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={color === c ? 'rounded-full ring-2 ring-cdm-primary ring-offset-2' : ''}
                >
                  <TitleBadge name={c} color={c} size="sm" />
                </button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-cdm-fg">설명 <span className="text-xs font-normal text-cdm-fg-muted">(유저에게 공개)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="예) 2026-05월 흑과백2 랭킹 1등 달성"
              className="rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-sm text-cdm-fg outline-none placeholder:text-cdm-fg-subtle focus:border-cdm-primary"
            />
          </div>

          {/* 활성 상태 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-cdm-primary"
            />
            <span className="text-sm text-cdm-fg">활성 (신규 부여 가능)</span>
          </label>

          {/* 미리보기 */}
          <div className="flex items-center gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 px-3 py-2">
            <span className="text-xs text-cdm-fg-muted">미리보기</span>
            {name.trim() && <TitleBadge name={name.trim()} color={color} size="md" />}
          </div>
        </div>
      </Modal>
    </>
  );
}
