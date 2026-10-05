# 효과음 출처와 파일 관리

새 효과음과 칩 수거음은 Kenney의 CC0 1.0 에셋을 사용한다.

- Casino Audio: https://kenney.nl/assets/casino-audio
- RPG Audio: https://kenney.nl/assets/rpg-audio
- Interface Sounds: https://kenney.nl/assets/interface-sounds

`manifest.json`에 각 파일의 원본 팩·원본 파일명·출처·가공 후 길이·기본 음량을 기록했다.
원문 라이선스는 `licenses/`에 있다. 모노 PCM WAV로 변환하고 앞뒤 무음·피크를 조절했다.
`chips/collect.wav`는 기존 칩 수거음과 동일한 `chips-handle-5.ogg`를 변환했다.

폴더: cards(배분·공개), chips(투입·쌓기·수거), match(픽·공개·제외·확정),
ui(차례), board(말 이동). 스킨별 파일은 ../skins/, BGM은 ../bgm/에 있다.

## 기존 음원

- `board/move.mp3`: 기존 추상전략 돌 놓기 음원. 기존 출처 기록 없음.
- `../skins/candy/*.mp3`, `../skins/meow/*.mp3`, `../skins/showdown/gunshot.mp3`:
  기존 스킨 음원을 유지·정리했다. 기존 출처 기록 없음.

파일 목록: `README.md`. 재생 설정: `lib/audio/catalog.ts`와 `lib/audio/settings.ts`.
