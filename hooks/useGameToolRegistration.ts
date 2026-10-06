import { useEffect, useRef } from 'react';
import { useGameToolsRegistration, type GameTool } from '@/contexts/GameToolsContext';

/** 등록 값은 갱신하되, 사라진 id와 실제 unmount에서만 제거한다. */
export function useGameToolRegistration(tools: GameTool[]) {
  const registration = useGameToolsRegistration();
  const register = registration?.register;
  const unregister = registration?.unregister;
  const previous = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!register || !unregister) return;
    const next = new Set(tools.map((tool) => tool.id));
    previous.current.forEach((id) => {
      if (!next.has(id)) unregister(id);
    });
    tools.forEach(register);
    previous.current = next;
  }, [tools, register, unregister]);
  useEffect(
    () => () => {
      previous.current.forEach((id) => unregister?.(id));
      previous.current.clear();
    },
    [unregister],
  );
  return registration?.desktop ?? false;
}
