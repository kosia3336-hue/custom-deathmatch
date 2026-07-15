import Link from 'next/link';
import { Button } from '@/components/cdm/Button';
import { Logo } from '@/components/cdm/Logo';

export default function DisconnectedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-cdm-bg px-4 text-center">
      <Logo size="md" />
      <h1 className="text-2xl font-bold text-cdm-fg">연결이 종료되었습니다</h1>
      <p className="max-w-sm text-sm text-cdm-fg-muted">
        다른 탭 또는 기기에서 접속이 감지되어 이 탭의 연결이 끊어졌습니다.
      </p>
      <Link href="/">
        <Button>로비로 돌아가기</Button>
      </Link>
    </div>
  );
}
