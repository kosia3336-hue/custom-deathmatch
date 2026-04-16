export default function DisconnectedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-5xl">🔌</div>
      <h1 className="text-2xl font-bold text-gray-900">연결이 종료되었습니다</h1>
      <p className="max-w-sm text-sm text-gray-500">
        다른 탭 또는 기기에서 접속이 감지되어 이 탭의 연결이 끊어졌습니다.
      </p>
    </div>
  );
}
