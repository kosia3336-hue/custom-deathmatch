'use client';

import { useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import {
  DEV_GUILD_DESC_MAX,
  DEV_GUILD_NAME_MAX,
  isValidDevGuildName,
} from './limits';

export function CreateGuildModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameValid = isValidDevGuildName(name);

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title="길드 창설"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            loading={busy}
            disabled={!nameValid || description.length > DEV_GUILD_DESC_MAX}
            onClick={() =>
              void onCreate(
                name.trim().slice(0, DEV_GUILD_NAME_MAX),
                description.trim().slice(0, DEV_GUILD_DESC_MAX),
              )
            }
          >
            창설 (창설권 1개 소모)
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-xs font-semibold text-cdm-fg-muted">길드 이름 (영어·한글만)</label>
            <span
              className={`tabular-nums text-[11px] ${
                name.length > DEV_GUILD_NAME_MAX ? 'text-cdm-danger' : 'text-cdm-fg-subtle'
              }`}
            >
              {name.length}/{DEV_GUILD_NAME_MAX}
            </span>
          </div>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, DEV_GUILD_NAME_MAX))}
            maxLength={DEV_GUILD_NAME_MAX}
          />
          {name.trim().length > 0 && !nameValid && (
            <p className="mt-1 text-[11px] text-cdm-danger">
              영어·한글 글자만, 2~{DEV_GUILD_NAME_MAX}자입니다. (공백·숫자·특수문자·이모지·자모 단독 입력 불가)
            </p>
          )}
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-xs font-semibold text-cdm-fg-muted">소개 (선택)</label>
            <span
              className={`tabular-nums text-[11px] ${
                description.length > DEV_GUILD_DESC_MAX ? 'text-cdm-danger' : 'text-cdm-fg-subtle'
              }`}
            >
              {description.length}/{DEV_GUILD_DESC_MAX}
            </span>
          </div>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
            rows={3}
            maxLength={DEV_GUILD_DESC_MAX}
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, DEV_GUILD_DESC_MAX))}
          />
        </div>
        <p className="text-[11px] text-cdm-fg-subtle">초기 정원은 3명입니다. 길드 포인트로 정원을 늘릴 수 있습니다.</p>
      </div>
    </Modal>
  );
}
