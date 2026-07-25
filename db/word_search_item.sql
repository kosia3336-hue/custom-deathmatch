-- ── 상점: '검색 찬스' 소비아이템 등록 (90 CDP) ──────────────────────────────
--
-- '단어조합' 게임 전용 보조 아이템.
--   · '단어조합' 게임이 시작될 때 자동으로 1개 사용(auto_use). 그 1게임 동안 검색창이 열린다.
--     (다른 게임에는 소모되지 않음 — initWordPuzzle 에서만 consumeWordSearchForRoom 호출)
--   · 게임 중 입력한 3글자 단어가 실제 표준국어대사전 표제어인지 무제한 조회 가능.
--   · 검증 사전은 서버 메모리(shared/data/three-letter-words-collected.ts, stdict 수집분)
--     이라 외부 API 호출이 없다(O(1)).
--   · consumable kind = 'word_search' (kind 컬럼은 free-text — enum/CHECK 없음).
--
-- 멱등: payload->>'kind' = 'word_search' 아이템이 없을 때만 삽입. 가격/활성은 이후 관리자 상점에서 조정.

INSERT INTO shop_items (type, name, description, price, payload, is_active, sort_order)
SELECT 'consumable', '검색 찬스',
       '단어조합 게임에서 입력한 단어가 실제 사전에 있는 단어인지 검색할 수 있어요. 단어조합 게임이 시작될 때 자동으로 1개가 사용되며, 그 게임 동안 무제한으로 검색할 수 있어요.',
       90, '{"kind":"word_search"}'::jsonb, true, 60
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE payload->>'kind' = 'word_search');
