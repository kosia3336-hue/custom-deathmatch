import { MarkdownView } from '@/lib/markdown';
import { cn } from '@/lib/utils';

interface Props {
  /** 게임 이름 — 상단 명판에 들어간다 */
  name: string;
  /** 갈래(심리·추상전략 …) — 명판 위 작은 태그 */
  category: string;
  /** 마크다운 룰 본문 */
  source: string;
  /**
   * 선택: 도해 이미지(관리자 페이지에서 등록). 글로 설명하기 어려운 게임판·배치도용.
   * 본문 위에 끼워 넣는다.
   */
  imageUrl?: string;
  className?: string;
}

/**
 * 룰지 — 배경 이미지 위에 룰 '텍스트'를 얹는다.
 *
 * 전에는 룰지를 통째로 이미지로 구웠는데, 폭이 좁아지면 글씨까지 같이 줄어들어
 * 모바일에서 읽기 힘들었다. 배경만 이미지로 두고 글자는 진짜 텍스트로 그리면
 * 화면 폭에 맞춰 알아서 접히고, 확대·복사·검색 수집도 그대로 된다.
 *
 * 배경(1251x800)은 폭에 맞춰 깔고(`100% auto`), 상단 명판이 있는 띠만 같은 비율의
 * 블록으로 잡아 두었다. 그래서 폭이 어떻게 바뀌어도 제목이 명판 안에 들어간다.
 * 본문이 길어 배경보다 아래로 넘어가면 같은 색 그라데이션이 이어받는다.
 */
export default function RuleSheet({ name, category, source, imageUrl, className }: Props) {
  return (
    <div className={cn('rule-sheet', className)}>
      <div className="rule-sheet__head">
        <span className="rule-sheet__cat">{category}</span>
        <h2 className="rule-sheet__title">{name}</h2>
      </div>

      <div className="rule-sheet__body">
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`${name} 게임판`}
            loading="lazy"
            className="mx-auto mb-5 h-auto w-full max-w-md rounded-cdm-md"
          />
        )}
        <MarkdownView source={source} />
      </div>
    </div>
  );
}
