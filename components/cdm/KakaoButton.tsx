'use client';

import { Button } from './Button';

interface KakaoButtonProps {
  onClick?: () => void | Promise<void>;
  loading?: boolean;
  fullWidth?: boolean;
}

/** 카카오 공식 색상의 로그인 버튼. (docs/v2/15_common_ui.md §15.14) */
export function KakaoButton({ onClick, loading, fullWidth = true }: KakaoButtonProps) {
  return (
    <Button
      variant="kakao"
      size="xl"
      fullWidth={fullWidth}
      onClick={onClick}
      loading={loading}
      leftIcon={<KakaoIcon />}
      aria-label="카카오로 시작"
    >
      카카오로 시작
    </Button>
  );
}

function KakaoIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.86 5.36 4.66 6.78L5.5 21l3.86-2.04c.86.12 1.74.18 2.64.18 5.52 0 10-3.58 10-8S17.52 3 12 3z"
        fill="currentColor"
      />
    </svg>
  );
}
