'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { TextInput } from '@/components/cdm/TextInput';
import { MarkdownWysiwyg } from '@/components/admin/MarkdownWysiwyg';
import { GAME_RULES, GAME_CATEGORIES, EMPTY_RULE_META, type GameRuleMeta } from '@/lib/gameRules';

interface Props {
  /** DB에 저장된 게임별 룰 텍스트 (마크다운) */
  initialTexts: Record<string, string>;
  initialMeta: Record<string, GameRuleMeta>;
  initialUpdatedAt: Record<string, string>;
  /** 게임별 룰 이미지 URL (없으면 빈 문자열) */
  initialImages: Record<string, string>;
}

function metaEquals(a: GameRuleMeta, b: GameRuleMeta): boolean {
  return (
    a.source === b.source &&
    a.originUrl === b.originUrl &&
    a.originalAuthor === b.originalAuthor &&
    a.poster === b.poster
  );
}

/**
 * 관리자 — 게임 룰 작성 도구.
 * 공용 WYSIWYG(MarkdownWysiwyg) 사용: 서식이 입력 즉시 그대로 보이고,
 * 마크다운으로 직렬화되어 룰 모달 렌더러(lib/markdown.tsx)와 호환된다.
 */
export default function AdminGameRulesEditor({
  initialTexts,
  initialMeta,
  initialUpdatedAt,
  initialImages,
}: Props) {
  const [texts, setTexts] = useState(initialTexts);
  const [metas, setMetas] = useState(initialMeta);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [selectedId, setSelectedId] = useState(GAME_RULES[0]!.id);
  const [draft, setDraft] = useState(initialTexts[GAME_RULES[0]!.id] ?? '');
  const [metaDraft, setMetaDraft] = useState<GameRuleMeta>(
    initialMeta[GAME_RULES[0]!.id] ?? EMPTY_RULE_META,
  );
  const [images, setImages] = useState(initialImages);
  const [imageDraft, setImageDraft] = useState(initialImages[GAME_RULES[0]!.id] ?? '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(() => GAME_RULES.find((g) => g.id === selectedId)!, [selectedId]);
  const savedText = texts[selectedId] ?? '';
  const savedMeta = metas[selectedId] ?? EMPTY_RULE_META;
  const savedImage = images[selectedId] ?? '';
  const dirty = draft !== savedText || !metaEquals(metaDraft, savedMeta) || imageDraft !== savedImage;

  function switchGame(id: string) {
    if (dirty && !confirm('저장하지 않은 변경 사항이 있습니다. 이동할까요?')) return;
    setSelectedId(id);
    setDraft(texts[id] ?? '');
    setMetaDraft(metas[id] ?? EMPTY_RULE_META);
    setImageDraft(images[id] ?? '');
  }

  /** 룰 이미지 업로드 — 성공하면 URL 만 들고 있다가 저장 시 함께 보낸다 */
  async function handleImagePick(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/game-rules/upload', { method: 'POST', body: form });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        toast.error(json.error ?? '이미지 업로드에 실패했습니다.');
        return;
      }
      setImageDraft(json.url);
      toast.success('이미지를 올렸습니다. 저장을 눌러야 반영됩니다.');
    } catch {
      toast.error('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/game-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: selectedId,
          rules: draft,
          source: metaDraft.source,
          originUrl: metaDraft.originUrl,
          originalAuthor: metaDraft.originalAuthor,
          poster: metaDraft.poster,
          imageUrl: imageDraft,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? '저장에 실패했습니다.');
        return;
      }
      setTexts((prev) => ({ ...prev, [selectedId]: draft }));
      setMetas((prev) => ({ ...prev, [selectedId]: { ...metaDraft } }));
      setImages((prev) => ({ ...prev, [selectedId]: imageDraft }));
      setUpdatedAt((prev) => ({ ...prev, [selectedId]: new Date().toISOString() }));
      toast.success(`${selected.name} 룰을 저장했습니다.`);
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S 저장
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, metaDraft, imageDraft, selectedId]);

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      {/* 게임 목록 */}
      <Card className="xl:w-56 xl:shrink-0">
        <h2 className="mb-2 text-sm font-semibold text-cdm-fg">게임 목록</h2>
        <ul className="flex flex-col gap-0.5">
          {GAME_CATEGORIES.map((cat) => {
            const list = GAME_RULES.filter((g) => g.category === cat);
            if (list.length === 0) return null;
            return (
              <li key={cat}>
                <p className="mt-2 mb-1 text-[11px] font-bold uppercase text-cdm-fg-subtle">{cat}</p>
                <ul className="flex flex-col gap-0.5">
                  {list.map((g) => {
                    const has = Boolean((texts[g.id] ?? '').trim());
                    return (
                      <li key={g.id}>
                        <button
                          type="button"
                          onClick={() => switchGame(g.id)}
                          className={`flex w-full items-center justify-between rounded-cdm-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                            g.id === selectedId
                              ? 'bg-cdm-primary-soft font-semibold text-cdm-primary'
                              : 'text-cdm-fg hover:bg-cdm-bg-elev-1'
                          }`}
                        >
                          <span className="truncate">{g.name}</span>
                          <span
                            className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full ${has ? 'bg-cdm-success' : 'bg-cdm-bg-elev-3'}`}
                            title={has ? '작성됨' : '미작성'}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* WYSIWYG 에디터 */}
      <Card className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-cdm-fg">
              {selected.name} <span className="text-xs font-normal text-cdm-fg-muted">({selected.category})</span>
            </h2>
            {updatedAt[selectedId] && (
              <p className="text-[11px] text-cdm-fg-subtle">
                마지막 저장: {new Date(updatedAt[selectedId]!).toLocaleString('ko-KR')}
              </p>
            )}
          </div>
          <Button size="sm" onClick={handleSave} loading={saving} disabled={!dirty}>
            {dirty ? '저장' : '저장됨'}
          </Button>
        </div>

        {/* 출처 메타 */}
        <div className="mb-3 grid grid-cols-1 gap-2 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3 sm:grid-cols-2">
          <div>
            <label className="text-[11px] font-semibold text-cdm-fg-muted">출처</label>
            <TextInput
              value={metaDraft.source}
              onChange={(e) => setMetaDraft((m) => ({ ...m, source: e.target.value }))}
              placeholder="예: 투자와 기부 (스타 지니어스)"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-cdm-fg-muted">원작자</label>
            <TextInput
              value={metaDraft.originalAuthor}
              onChange={(e) => setMetaDraft((m) => ({ ...m, originalAuthor: e.target.value }))}
              placeholder="예: 아칸"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-cdm-fg-muted">원본 룰 링크</label>
            <TextInput
              value={metaDraft.originUrl}
              onChange={(e) => setMetaDraft((m) => ({ ...m, originUrl: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-cdm-fg-muted">게시자</label>
            <TextInput
              value={metaDraft.poster}
              onChange={(e) => setMetaDraft((m) => ({ ...m, poster: e.target.value }))}
              placeholder="원본 룰 게시자를 작성해 주세요."
            />
          </div>
        </div>

        {/* 룰 이미지 — 룰 페이지·소개 페이지·인게임 모달의 맨 위에 그대로 뜬다 */}
        <div className="mt-3 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-cdm-fg-muted">룰 이미지</span>
            <label className="cursor-pointer rounded-cdm-md border border-cdm-border px-2.5 py-1 text-xs font-semibold text-cdm-fg transition hover:bg-cdm-bg-elev-2">
              {uploading ? '업로드 중…' : imageDraft ? '이미지 교체' : '이미지 올리기'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleImagePick(f);
                  e.target.value = '';
                }}
              />
            </label>
            {imageDraft && (
              <button
                type="button"
                onClick={() => setImageDraft('')}
                className="rounded-cdm-md border border-cdm-border px-2.5 py-1 text-xs font-semibold text-cdm-danger transition hover:bg-cdm-bg-elev-2"
              >
                이미지 삭제
              </button>
            )}
            {!imageDraft && (
              <span className="text-[11px] text-cdm-fg-subtle">
                없으면 텍스트만 보여집니다.
              </span>
            )}
          </div>
          {imageDraft && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageDraft}
                alt="룰 이미지 미리보기"
                className="h-auto w-full max-w-lg rounded-cdm-md border border-cdm-border"
              />
              <p className="mt-1 break-all text-[10px] text-cdm-fg-subtle">{imageDraft}</p>
            </div>
          )}
        </div>

        <MarkdownWysiwyg
          value={draft}
          onChange={setDraft}
          resetKey={selectedId}
          minHeightClass="min-h-[480px]"
          uploadEndpoint="/api/admin/game-rules/upload"
        />

        {/* 출처 메타 미리보기 */}
        {(metaDraft.source || metaDraft.originUrl || metaDraft.originalAuthor || metaDraft.poster) && (
          <div className="mt-3 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3 text-xs leading-relaxed text-cdm-fg-muted">
            {metaDraft.source && <p>출처: {metaDraft.source}</p>}
            {metaDraft.originalAuthor && <p>원작자: {metaDraft.originalAuthor}</p>}
            {metaDraft.poster && <p>게시자: {metaDraft.poster}</p>}
            {metaDraft.originUrl && <p className="truncate">원본 룰: {metaDraft.originUrl}</p>}
          </div>
        )}

        <p className="mt-2 text-[11px] text-cdm-fg-subtle">
          보이는 그대로 저장됩니다. 단축키: Ctrl+B 굵게 · Ctrl+I 기울임 · Ctrl+Shift+X 취소선 ·
          Ctrl+S 저장. 이미지는 [사진] 버튼 또는 클립보드 붙여넣기로 업로드됩니다. 저장하면 룰
          페이지와 인게임 룰 모달에 바로 반영됩니다 (최대 1분 캐시).
        </p>
      </Card>
    </div>
  );
}
