'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

export interface AttachedFile {
  id: string;
  url: string;
}

interface Props {
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
  max?: number;
  disabled?: boolean;
}

/** 문의/신고 스크린샷 첨부 — 다중 업로드 + 썸네일 미리보기. */
export function AttachmentPicker({ files, onChange, max = 5, disabled }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(list: FileList | File[]) {
    const remain = max - files.length;
    const targets = Array.from(list).slice(0, remain);
    if (Array.from(list).length > remain) {
      toast.error(`스크린샷은 최대 ${max}장까지 첨부할 수 있어요.`);
    }
    if (targets.length === 0) return;

    setUploading(true);
    try {
      const added: AttachedFile[] = [];
      for (const f of targets) {
        const form = new FormData();
        form.append('file', f);
        const res = await fetch('/api/support/upload', { method: 'POST', body: form });
        const json = (await res.json()) as { ok?: boolean; id?: string; url?: string; error?: string };
        if (!res.ok || !json.ok || !json.id || !json.url) {
          toast.error(json.error ?? `${f.name} 업로드에 실패했어요.`);
          continue;
        }
        added.push({ id: json.id, url: json.url });
      }
      if (added.length > 0) onChange([...files, ...added]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-cdm-fg">
          스크린샷 첨부
          <span className="ml-1.5 text-xs font-normal text-cdm-fg-subtle">
            (선택 · 최대 {max}장 · 장당 5MB)
          </span>
        </label>
        <button
          type="button"
          disabled={disabled || uploading || files.length >= max}
          onClick={() => inputRef.current?.click()}
          className="rounded-cdm-md border border-cdm-border px-2.5 py-1 text-xs font-semibold text-cdm-fg transition-colors hover:border-cdm-primary hover:text-cdm-primary disabled:opacity-50"
        >
          {uploading ? '업로드 중…' : '+ 사진 추가'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f) => (
            <div key={f.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={f.url}
                alt="첨부 스크린샷"
                className="h-20 w-20 rounded-cdm-md border border-cdm-border object-cover"
              />
              <button
                type="button"
                aria-label="첨부 제거"
                disabled={disabled}
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-cdm-fg text-[11px] leading-none text-white hover:bg-cdm-accent"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 제출 성공 후 첨부를 대상에 연결 */
export async function linkAttachments(
  files: AttachedFile[],
  targetKind: 'inquiry' | 'report',
  targetId: string,
): Promise<void> {
  if (files.length === 0) return;
  try {
    await fetch('/api/support/attach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileIds: files.map((f) => f.id), targetKind, targetId }),
    });
  } catch {
    // 연결 실패는 치명적이지 않음 — 본문은 이미 접수됨
  }
}
