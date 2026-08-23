import Link from 'next/link';

export function GuildBackLink() {
  return (
    <Link href="/guild" className="text-sm font-medium text-cdm-primary hover:underline">
      ← 돌아가기
    </Link>
  );
}
