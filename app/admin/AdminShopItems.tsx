'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { EmptyState } from '@/components/cdm/EmptyState';
import { Modal } from '@/components/cdm/Modal';
import { TextInput } from '@/components/cdm/TextInput';
import { formatCdp } from '@/lib/cdp/format';
import { labelForType } from '@/lib/cdp/types';

interface ShopItemAdminRow {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  stock: number | null;
  is_active: boolean;
  is_limited: boolean;
  payload: Record<string, unknown> | null;
  available_from: string | null;
  available_until: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface FormState {
  type: string;
  name: string;
  description: string;
  price: string;
  payloadJson: string;
  stock: string;
  isActive: boolean;
  isLimited: boolean;
  availableFrom: string;
  availableUntil: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  type: 'cosmetic',
  name: '',
  description: '',
  price: '0',
  payloadJson: '{}',
  stock: '',
  isActive: true,
  isLimited: false,
  availableFrom: '',
  availableUntil: '',
  sortOrder: '0',
};

export default function AdminShopItems() {
  const [items, setItems] = useState<ShopItemAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<ShopItemAdminRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/shop/items', { cache: 'no-store' });
      const json = (await res.json()) as { items?: ShopItemAdminRow[] };
      setItems(json.items ?? []);
    } catch {
      toast.error('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleActive(item: ShopItemAdminRow) {
    const next = !item.is_active;
    const res = await fetch(`/api/admin/shop/items/${item.id}/active`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: next }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(j.error ?? '실패');
      return;
    }
    toast.success(next ? '활성화했습니다' : '비활성화했습니다');
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_active: next } : i)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-cdm-fg">아이템 ({items.length})</h2>
        <Button size="sm" variant="primary" onClick={() => setCreateOpen(true)}>
          + 새 아이템
        </Button>
      </div>

      {loading ? (
        <Card>
          <p className="text-sm text-cdm-fg-muted">불러오는 중…</p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          title="등록된 아이템이 없습니다"
          description="첫 아이템을 등록해 상점을 시작하세요"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li key={it.id}>
              <Card className="p-3!">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-cdm-sm bg-cdm-bg-elev-2 px-1.5 py-0.5 text-[11px] font-mono text-cdm-fg-muted">
                        {labelForType(it.type)}
                      </span>
                      {!it.is_active && (
                        <span className="rounded-full bg-cdm-fg/70 px-2 py-0.5 text-[10px] font-bold text-white">
                          비활성
                        </span>
                      )}
                      {it.is_limited && (
                        <span className="rounded-full bg-cdm-accent px-2 py-0.5 text-[10px] font-bold text-white">
                          한정
                        </span>
                      )}
                      <span className="text-sm font-semibold text-cdm-fg">{it.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-cdm-fg-subtle tabular-nums">
                      {formatCdp(it.price)} · 재고{' '}
                      {it.stock === null ? '무제한' : it.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setEditTarget(it)}>
                      편집
                    </Button>
                    <Button
                      size="sm"
                      variant={it.is_active ? 'tertiary' : 'primary'}
                      onClick={() => toggleActive(it)}
                    >
                      {it.is_active ? '비활성화' : '활성화'}
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <ShopItemFormModal
          mode="create"
          initial={EMPTY_FORM}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            void refresh();
          }}
        />
      )}

      {editTarget && (
        <ShopItemFormModal
          mode="edit"
          itemId={editTarget.id}
          initial={toFormState(editTarget)}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}

function toFormState(it: ShopItemAdminRow): FormState {
  return {
    type: it.type,
    name: it.name,
    description: it.description ?? '',
    price: String(it.price),
    payloadJson: JSON.stringify(it.payload ?? {}, null, 2),
    stock: it.stock === null ? '' : String(it.stock),
    isActive: it.is_active,
    isLimited: it.is_limited,
    availableFrom: toLocalInput(it.available_from),
    availableUntil: toLocalInput(it.available_until),
    sortOrder: String(it.sort_order),
  };
}

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  // local datetime → ISO
  return new Date(local).toISOString();
}

interface FormProps {
  mode: 'create' | 'edit';
  itemId?: string;
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}

function ShopItemFormModal({ mode, itemId, initial, onClose, onSaved }: FormProps) {
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (busy) return;
    let payload: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(form.payloadJson || '{}');
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        toast.error('payload 는 JSON 객체여야 합니다.');
        return;
      }
      payload = parsed as Record<string, unknown>;
    } catch {
      toast.error('payload JSON 파싱 실패');
      return;
    }

    const price = Number(form.price);
    if (!Number.isInteger(price) || price < 0 || price > 1_000_000) {
      toast.error('가격은 0~1,000,000 정수');
      return;
    }
    const stockNum = form.stock === '' ? null : Number(form.stock);
    if (stockNum !== null && (!Number.isInteger(stockNum) || stockNum < 0)) {
      toast.error('재고는 비우거나 0 이상 정수');
      return;
    }
    const sortOrder = Number(form.sortOrder || 0);

    setBusy(true);
    try {
      const body = {
        type: form.type.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        payload,
        stock: stockNum,
        isActive: form.isActive,
        isLimited: form.isLimited,
        availableFrom: fromLocalInput(form.availableFrom),
        availableUntil: fromLocalInput(form.availableUntil),
        sortOrder,
      };

      const url = mode === 'create' ? '/api/admin/shop/items' : `/api/admin/shop/items/${itemId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(j.error ?? '저장 실패');
        return;
      }
      toast.success(mode === 'create' ? '등록했습니다' : '저장했습니다');
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={mode === 'create' ? '새 아이템' : '아이템 편집'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave} loading={busy}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">타입 (영문 소문자)</label>
          <TextInput
            value={form.type}
            onChange={(e) => setField('type', e.target.value)}
            placeholder="cosmetic"
            disabled={mode === 'edit'}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">정렬 순서</label>
          <TextInput
            type="number"
            value={form.sortOrder}
            onChange={(e) => setField('sortOrder', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-cdm-fg-muted">이름 (1~60)</label>
          <TextInput value={form.name} onChange={(e) => setField('name', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-cdm-fg-muted">설명 (~500)</label>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 text-sm"
            rows={3}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">가격 (CDP)</label>
          <TextInput
            type="number"
            value={form.price}
            onChange={(e) => setField('price', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">재고 (빈칸=무제한)</label>
          <TextInput
            type="number"
            value={form.stock}
            onChange={(e) => setField('stock', e.target.value)}
            placeholder="비우면 무제한"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">판매 시작</label>
          <TextInput
            type="datetime-local"
            value={form.availableFrom}
            onChange={(e) => setField('availableFrom', e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-cdm-fg-muted">판매 종료</label>
          <TextInput
            type="datetime-local"
            value={form.availableUntil}
            onChange={(e) => setField('availableUntil', e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          {mode === 'create' && (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setField('isActive', e.target.checked)}
              />
              활성
            </label>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isLimited}
              onChange={(e) => setField('isLimited', e.target.checked)}
            />
            한정판 표시
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-cdm-fg-muted">payload (JSON)</label>
          <textarea
            className="mt-1 w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-2 font-mono text-xs"
            rows={4}
            value={form.payloadJson}
            onChange={(e) => setField('payloadJson', e.target.value)}
          />
          <p className="mt-1 text-[11px] text-cdm-fg-subtle">
            예: <code>{'{"unique": true}'}</code> 또는{' '}
            <code>{'{"unique": true, "title_id": "<uuid>"}'}</code>
          </p>
        </div>
      </div>
    </Modal>
  );
}
