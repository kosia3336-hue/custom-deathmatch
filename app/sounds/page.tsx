import type { Metadata } from 'next';
import { SoundLibrary } from '@/components/cdm/SoundLibrary';

export const metadata: Metadata = { title: '소리 모음', description: '커스텀 데스매치 게임·스킨 효과음 파일을 미리 듣습니다.', alternates: { canonical: '/sounds' } };
export default function SoundsPage() { return <SoundLibrary />; }
