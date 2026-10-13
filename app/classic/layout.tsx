import type { Metadata } from 'next';
import ClassicShell from '@/classic-era/components/ClassicShell';

export const metadata: Metadata = {
  title: { absolute: '더 지니어스' },
  description: '사중력 사목만 있던 초창기 로비',
  robots: { index: false, follow: false },
};

export default function ClassicLayout({ children }: { children: React.ReactNode }) {
  return <ClassicShell>{children}</ClassicShell>;
}
