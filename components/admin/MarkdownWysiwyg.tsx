'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapImage from '@tiptap/extension-image';
import TiptapLink from '@tiptap/extension-link';
import { Markdown } from 'tiptap-markdown';

interface Props {
  /** 초기(및 resetKey 변경 시 재설정할) 마크다운 */
  value: string;
  /** 편집 시 직렬화된 마크다운 */
  onChange: (markdown: string) => void;
  /** 이 값이 바뀌면 에디터 내용을 value 로 재설정 (문서 전환용) */
  resetKey?: string | number;
  placeholder?: string;
  minHeightClass?: string;
  /** 이미지 업로드 API (multipart 'file' → {ok, url}). 없으면 사진 버튼 숨김 */
  uploadEndpoint?: string;
}

/**
 * 관리자 공용 마크다운 WYSIWYG 에디터 (TipTap).
 * 굵게/기울임 등이 입력 즉시 그대로 보이고, 저장은 마크다운으로 직렬화되어
 * lib/markdown.tsx(MarkdownView) 렌더러와 호환된다.
 * 게임 룰 작성 · 공지 작성 공용.
 */
export function MarkdownWysiwyg({
  value,
  onChange,
  resetKey,
  placeholder,
  minHeightClass = 'min-h-[280px]',
  uploadEndpoint,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<(file: File) => void>(() => {});

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3, 4] }, link: false }),
      TiptapLink.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https'] }),
      TiptapImage,
      Markdown.configure({ html: false, breaks: true, transformPastedText: true, transformCopiedText: true }),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(
        (ed.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown(),
      );
    },
    editorProps: {
      attributes: {
        class: `rule-editor ${minHeightClass} w-full rounded-cdm-md border border-cdm-border bg-cdm-bg p-4 text-[15px] leading-7 text-cdm-fg focus:outline-none focus:ring-2 focus:ring-cdm-primary/30`,
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handlePaste: (_view, event) => {
        if (!uploadEndpoint) return false;
        const item = Array.from(event.clipboardData?.items ?? []).find((it) =>
          it.type.startsWith('image/'),
        );
        if (item) {
          const f = item.getAsFile();
          if (f) {
            event.preventDefault();
            uploadRef.current(f);
            return true;
          }
        }
        return false;
      },
    },
  });

  // 문서 전환 시 내용 재설정
  const lastReset = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== lastReset.current) {
      lastReset.current = resetKey;
      editor?.commands.setContent(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  async function uploadImage(file: File) {
    if (!uploadEndpoint) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(uploadEndpoint, { method: 'POST', body: form });
      const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
      if (!res.ok || !json.ok || !json.url) {
        toast.error(json.error ?? '이미지 업로드에 실패했어요.');
        return;
      }
      editor?.chain().focus().setImage({ src: json.url, alt: '이미지' }).run();
      toast.success('이미지를 넣었어요.');
    } finally {
      setUploading(false);
    }
  }
  uploadRef.current = (f) => void uploadImage(f);

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = prompt('링크 URL (https://...)', prev ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url.trim() }).run();
  }

  return (
    <div>
      {editor && (
        <Toolbar
          editor={editor}
          uploading={uploading}
          showImage={Boolean(uploadEndpoint)}
          onImageClick={() => fileRef.current?.click()}
          onLinkClick={setLink}
        />
      )}
      {uploadEndpoint && (
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadImage(f);
            e.target.value = '';
          }}
        />
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  uploading,
  showImage,
  onImageClick,
  onLinkClick,
}: {
  editor: Editor;
  uploading: boolean;
  showImage: boolean;
  onImageClick: () => void;
  onLinkClick: () => void;
}) {
  const items: { label: React.ReactNode; title: string; active?: boolean; onClick: () => void }[] = [
    {
      label: <span className="font-bold">H3</span>,
      title: '큰 제목',
      active: editor.isActive('heading', { level: 3 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: <span className="font-semibold">H4</span>,
      title: '작은 제목',
      active: editor.isActive('heading', { level: 4 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    },
    {
      label: <strong>B</strong>,
      title: '굵게 (Ctrl+B)',
      active: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: <em>I</em>,
      title: '기울임 (Ctrl+I)',
      active: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: <del>S</del>,
      title: '취소선 (Ctrl+Shift+X)',
      active: editor.isActive('strike'),
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: <code className="text-[11px]">{'<>'}</code>,
      title: '코드',
      active: editor.isActive('code'),
      onClick: () => editor.chain().focus().toggleCode().run(),
    },
    {
      label: '•',
      title: '글머리 기호',
      active: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '1.',
      title: '번호 목록',
      active: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: '❝',
      title: '인용',
      active: editor.isActive('blockquote'),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: '—',
      title: '구분선',
      onClick: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      label: '🔗',
      title: '링크',
      active: editor.isActive('link'),
      onClick: onLinkClick,
    },
  ];

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1 rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-1.5">
      {items.map((t, i) => (
        <button
          key={i}
          type="button"
          title={t.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={t.onClick}
          className={`flex h-8 min-w-8 items-center justify-center rounded-cdm-md px-1.5 text-sm transition-colors ${
            t.active ? 'bg-cdm-primary-soft text-cdm-primary' : 'text-cdm-fg hover:bg-cdm-bg-elev-2'
          }`}
        >
          {t.label}
        </button>
      ))}
      {showImage && (
        <button
          type="button"
          title="이미지 업로드 (붙여넣기도 가능)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onImageClick}
          disabled={uploading}
          className="flex h-8 items-center justify-center gap-1 rounded-cdm-md px-2 text-sm text-cdm-fg transition-colors hover:bg-cdm-bg-elev-2 disabled:opacity-50"
        >
          {uploading ? '업로드 중…' : '사진'}
        </button>
      )}
    </div>
  );
}
