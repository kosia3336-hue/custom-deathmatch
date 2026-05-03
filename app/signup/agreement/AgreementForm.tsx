'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { Modal } from '@/components/cdm/Modal';

export interface AgreementVersion {
  id: number;
  kind: 'terms' | 'privacy' | 'marketing';
  version: number;
  body: string;
}

const META: Record<
  AgreementVersion['kind'],
  { label: string; required: boolean; sortOrder: number }
> = {
  terms: { label: '서비스 이용약관', required: true, sortOrder: 1 },
  privacy: { label: '개인정보 처리방침', required: true, sortOrder: 2 },
  marketing: { label: '마케팅 정보 수신', required: false, sortOrder: 3 },
};

const STORAGE_KEY = 'cdm:signup:agreed';

export default function AgreementForm({ versions }: { versions: AgreementVersion[] }) {
  const router = useRouter();
  const sorted = useMemo(
    () => [...versions].sort((a, b) => META[a.kind].sortOrder - META[b.kind].sortOrder),
    [versions],
  );

  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [age14, setAge14] = useState(false);
  const [openBody, setOpenBody] = useState<AgreementVersion | null>(null);

  const allRequiredOk =
    age14 &&
    sorted
      .filter((v) => META[v.kind].required)
      .every((v) => checked[`${v.kind}:${v.version}`]);

  const allChecked =
    age14 &&
    sorted.every((v) => checked[`${v.kind}:${v.version}`]);

  function toggleAll(next: boolean) {
    setAge14(next);
    const map: Record<string, boolean> = {};
    sorted.forEach((v) => (map[`${v.kind}:${v.version}`] = next));
    setChecked(map);
  }

  function toggleOne(v: AgreementVersion, next: boolean) {
    setChecked((m) => ({ ...m, [`${v.kind}:${v.version}`]: next }));
  }

  function handleNext() {
    const agreed = sorted
      .filter((v) => checked[`${v.kind}:${v.version}`])
      .map((v) => ({ kind: v.kind, version: v.version }));
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(agreed));
    } catch {
      // ignore
    }
    router.push('/signup/profile');
  }

  function handleCancel() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    router.push('/auth/signout');
  }

  if (sorted.length === 0) {
    return (
      <Card>
        <p className="text-sm text-cdm-fg-muted">
          현재 활성화된 약관이 없습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <label className="flex cursor-pointer items-center gap-3 border-b border-cdm-border pb-3">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 accent-cdm-primary"
          />
          <span className="font-semibold text-cdm-fg">전체 동의</span>
        </label>

        <ul className="mt-3 flex flex-col gap-3">
          {sorted.map((v) => (
            <li key={`${v.kind}:${v.version}`} className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!checked[`${v.kind}:${v.version}`]}
                  onChange={(e) => toggleOne(v, e.target.checked)}
                  className="h-4 w-4 accent-cdm-primary"
                />
                <span className="text-cdm-fg">
                  <span
                    className={
                      META[v.kind].required ? 'text-cdm-accent' : 'text-cdm-fg-muted'
                    }
                  >
                    ({META[v.kind].required ? '필수' : '선택'})
                  </span>{' '}
                  {META[v.kind].label}
                </span>
              </label>
              <button
                type="button"
                onClick={() => setOpenBody(v)}
                className="text-xs text-cdm-fg-muted hover:text-cdm-fg underline-offset-2 hover:underline"
              >
                전문 보기 ▸
              </button>
            </li>
          ))}

          <li>
            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={age14}
                onChange={(e) => setAge14(e.target.checked)}
                className="h-4 w-4 accent-cdm-primary"
              />
              <span className="text-cdm-fg">
                <span className="text-cdm-accent">(필수)</span> 만 14세 이상입니다
              </span>
            </label>
          </li>
        </ul>
      </Card>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" onClick={handleCancel}>
          취소
        </Button>
        <Button onClick={handleNext} disabled={!allRequiredOk}>
          다음
        </Button>
      </div>

      <Modal
        open={!!openBody}
        onClose={() => setOpenBody(null)}
        title={openBody ? META[openBody.kind].label : ''}
        size="lg"
      >
        <article className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto whitespace-pre-wrap text-sm text-cdm-fg">
          {openBody?.body}
        </article>
      </Modal>
    </>
  );
}
