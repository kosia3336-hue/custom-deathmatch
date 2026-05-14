import { redirect } from 'next/navigation';
import { getActiveMember } from '@/lib/auth/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const member = await getActiveMember();
  if (!member) redirect('/login');
  if (member.role !== 'admin') redirect('/');

  return <>{children}</>;
}
