import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { getAuthState } from '@/lib/auth/server';

interface NoticeReadRow {
  notice_id: string;
}

export async function GET() {
  const auth = await getAuthState();
  if (auth.kind !== 'ACTIVE') {
    return NextResponse.json({ count: 0 });
  }

  const memberId = auth.member.id;
  const sb = await getServerSupabase();

  const [totalRes, readsRes] = await Promise.all([
    sb
      .from('notices')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true),
    sb
      .from('notice_reads')
      .select('notice_id')
      .eq('member_id', memberId),
  ]);

  const totalCount = totalRes.count ?? 0;
  const uniqueReadIds = new Set(
    ((readsRes.data ?? []) as unknown as NoticeReadRow[]).map((r) => r.notice_id),
  );

  const count = Math.max(0, totalCount - uniqueReadIds.size);
  return NextResponse.json({ count });
}
