'use client';

import { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import {
  fetchInquiryCategories,
  type InquiryCategoryRow,
} from '@/lib/inquiry/categories';

export function useInquiryCategories(opts?: { activeOnly?: boolean; enabled?: boolean }) {
  const activeOnly = opts?.activeOnly ?? false;
  const enabled = opts?.enabled ?? true;
  const [cats, setCats] = useState<InquiryCategoryRow[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetchInquiryCategories(getBrowserSupabase(), { activeOnly })
      .then((rows) => {
        if (!cancelled) setCats(rows);
      })
      .catch(() => {
        if (!cancelled) setCats([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOnly, enabled]);

  return { cats, loading };
}
