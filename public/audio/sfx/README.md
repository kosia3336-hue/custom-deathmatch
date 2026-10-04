# 커스텀 데스매치 효과음 목록

공개 미리 듣기 페이지 없이 이 파일과 실제 음원 파일을 직접 확인한다.
로컬 재생: Finder에서 음원 선택 후 스페이스(Quick Look), 또는 `afplay <파일 경로>`.

## 파일 음원

전체 재생 설정은 `lib/audio/catalog.ts`, 새 원본 정보는 `manifest.json`.
기본 음량에 공통 효과음 슬라이더 값이 곱해진다.

| 효과음 | 사용 시점 | 파일 | 기본 음량 |
| --- | --- | --- | --- |
| 카드 배분 (`cardDeal`) | 포커 새 라운드 카드 배분 | [cards/deal.wav](cards/deal.wav) | 0.5 |
| 카드 공개 (`cardFlip`) | 가려진 카드가 앞면으로 바뀔 때 | [cards/flip.wav](cards/flip.wav) | 0.5 |
| 칩 투입 (`chipPlace`) | 서버가 베팅을 확정했을 때 | [chips/place.wav](chips/place.wav) | 0.65 |
| 칩 쌓기 (`chipRaise`) | 큰 베팅·레이즈가 확정됐을 때 | [chips/raise.wav](chips/raise.wav) | 0.55 |
| 카운터 픽 잠금 (`matchPick`) | 서버가 내 선택을 확인했을 때 | [match/pick-lock.wav](match/pick-lock.wav) | 0.55 |
| 카운터 픽 공개 (`matchReveal`) | 양쪽 선택이 공개될 때 | [match/reveal.wav](match/reveal.wav) | 0.5 |
| 카운터 게임 제외 (`matchEliminate`) | 고른 게임이 제외될 때 | [match/eliminate.wav](match/eliminate.wav) | 0.42 |
| 카운터 게임 확정 (`matchConfirm`) | 최종 게임이 결정됐을 때 | [match/confirm.wav](match/confirm.wav) | 0.5 |
| 내 차례 (`turn`) | 기본 포커에서 내 차례가 시작될 때 | [ui/turn.wav](ui/turn.wav) | 0.35 |
| 칩 수거 (`chipCollect`) | 라운드 종료 후 팟이 넘어갈 때 | [chips/collect.wav](chips/collect.wav) | 0.55 |
| 보드 이동 | 서버가 확정한 말·돌 이동 | [board/move.mp3](board/move.mp3) | 0.55 |
| 유리설탕 병 열기 | + / MAX / 제출 | [../skins/candy/button.mp3](../skins/candy/button.mp3) | 0.5 |
| 유리설탕 카드 선택 | 카드 선택 | [../skins/candy/card.mp3](../skins/candy/card.mp3) | 0.55 |
| 유리설탕 병 닫기 | -5 / -1 | [../skins/candy/minus.mp3](../skins/candy/minus.mp3) | 0.5 |
| 냥냥 타일 0~4 (5개) | 타일 선택 | `../skins/meow/tile-{0..4}.mp3` | 0.55 |
| 서부극 발사 | 제출 확정 | [../skins/showdown/gunshot.mp3](../skins/showdown/gunshot.mp3) | 1.0 |

## 기존 합성음

이번 파일 교체 대상은 타뷸라 전체 합성음이다. 아래 커스텀 데스매치의 이벤트·스킨 전용 합성음은 유지하고 폴더를 정리했다.

| 코드 | 피드백 |
| --- | --- |
| `lib/audio/synth/general.ts` | 카운트다운, 봄비, 스킨 추첨, 순서 추첨, 밴·언밴, 랭크 알림, 성탑 붕괴·완성, 고양이 합성음 |
| `lib/audio/synth/indian-holdem-event.ts` | 이벤트 홀덤 배분·콜·레이즈·다이·페널티·승패·내 차례 |
| `lib/audio/synth/sun-moon-star.ts` | 해달별 선택·공개·빛·공허·점수·페널티·시간 초과 |
| `lib/audio/synth/capture.ts` | 양면체스 포획 |
| `lib/audio/synth/rank-notification.ts` | 랭크 매칭 완료 |
| `lib/audio/skins/nocturne.ts` | 무월 배분·콜·레이즈·다이 |
| `lib/audio/skins/showdown.ts` | 서부극 릴 틱·휙 소리 (총성만 파일) |

## 적용 코드

- `hooks/useGameAudio.ts`: 게임 진입·이탈, 공개 카드 피드백, 서버 베팅 상태 연결.
- `lib/audio/feedback.ts`: 베팅·배분·차례·카운터 매치 상태 변화 판정.
- `components/game/modules/counter-ban/index.tsx`: 서버가 확정한 픽·공개·제외·확정.
- `lib/audio/player.ts`: 음원 캐시, 중복음 합치기, 로딩 지연·화면 이탈·음소거 시 취소.
- `lib/audio/settings.ts`: 기존 공통 효과음 음량·음소거 설정.
- 출처와 라이선스: `CREDITS.md`, `licenses/`.
