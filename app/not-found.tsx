import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <div className="text-6xl">🔍</div>
      <h1 className="text-2xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-gray-500">요청하신 페이지가 없거나 이동되었습니다.</p>
      <Link
        href="/"
        className="mt-4 inline-flex h-10 items-center rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700"
      >
        홈으로
      </Link>
    </div>
  );
}
