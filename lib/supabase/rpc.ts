/**
 * Supabase RPC / select 호출 헬퍼.
 *
 * supabase-js v2 의 타입 추론은 Database 제네릭이 정확한 GenericSchema
 * 형태와 미묘하게 다르면 결과를 `never` 로 좁혀버린다.
 * (Args = undefined / Row = never 현상)
 *
 * 본 헬퍼는 Database 의 시그니처는 IDE 자동완성에 그대로 사용하고,
 * 실제 호출은 unknown 캐스트로 우회하여 안정적으로 결과를 반환한다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

type Public = Database['public'];
type FnName = keyof Public['Functions'];
type TableName = keyof Public['Tables'];

export async function callRpc<N extends FnName>(
  client: SupabaseClient<Database>,
  name: N,
  args: Public['Functions'][N]['Args'],
): Promise<Public['Functions'][N]['Returns']> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client.rpc as any)(name as string, args);
  if (error) throw error;
  return data as Public['Functions'][N]['Returns'];
}

/**
 * 단순 select 헬퍼. 결과는 Row 타입으로 캐스팅해서 돌려준다.
 * 복잡한 join 은 별도 select 로 분리하거나, 본 헬퍼 대신 직접 호출 후 캐스트.
 */
export function table<T extends TableName>(
  client: SupabaseClient<Database>,
  name: T,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(name as string) as ReturnType<
    SupabaseClient['from']
  >;
}

