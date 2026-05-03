'use client';

import { useParams } from 'next/navigation';
import ResultLog from '@/components/game/ResultLog';
import { useRoom } from '@/hooks/useRoom';

export default function ResultPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  useRoom(roomId);
  return <ResultLog />;
}
