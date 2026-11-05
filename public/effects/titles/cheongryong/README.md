# 창공의 청룡 · 타원형 경로/구름

## 현재 표시

`dragon-travel.webp` (1280×427, 194,940바이트): 새로 편집한 긴 청룡 원화가 타원형 명패 테두리를 **시계 방향으로 30초에 한 바퀴** 따라 이동한다. 머리/꼬리는 분리되어 꼬리를 물지 않는다. 몸의 텍스처만 경로에 매핑하고 머리는 회전+균일 배율만 사용한다. 이미지 전체를 회전하거나 `scaleY`로 압축하지 않는다. 글자는 고정되며, 용의 연결부가 잘리지 않도록 용이 글자 앞에 일부 겹친다. 구름은 별도로 계속 흐른다. 눈/얼굴 재생성, hue 필터, 팔레트 축소가 없는 lossless WebP다.

원화: `assets/title-effects/cheongryong/ellipse/dragon-straight-source.png`. 프롬프트: `ellipse/prompt.md`. **Built-in imagegen으로 기존 에셋을 직접 편집**했다. 원본 윤곽을 그대로 사용하는 단순 배색 버전이 아니다.

재생성: `node scripts/prepare-cheongryong-ellipse.mjs` (WebP/리그 JSON). 기존 `prepare-cheongryong-asset.mjs`도 최신 생성기로 연결된다. `--poses`는 이전 8포즈 보관본이며 현재 런타임에 사용하지 않는다. 문서당 공유 WebGL컨텍스트/rAF1개, 최대30fps, 정적 메시1회 업로드/프레임당 drawArrays1회이며 필요한 표시 해상도만 사용한다. 화면 밖·숨긴 탭·모션 감소에서는 반복 렌더를 중단한다. WebGL 불가 시 공유 Canvas2D 최대20fps 폴백. 이전 원형 `dragon-orbit.webp`는 비교용이다.

원화는 그대로 사용하며, 국소 메시로 네 발/두 수염 끝을 움직인다(`cheongryong-articulation.ts`). 얼굴은 고정한다. 명패 경로 가로폭은420 논리px로 좌우 테두리에 밀착한다. 새로운 프레임 이미지 다운로드는 없다.

## 기반 에셋

- **Dragon from Chinese Dragon Banner.svg** — 百楽兎 / Πrate, Openclipart 유래.
- 원본/CC0: https://commons.wikimedia.org/wiki/File:Dragon_from_Chinese_Dragon_Banner.svg
- 다운로드: https://upload.wikimedia.org/wikipedia/commons/5/5e/Dragon_from_Chinese_Dragon_Banner.svg
- CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- 보관: `assets/title-effects/cheongryong/eastern-dragon.svg`.
- SHA-256: `098e5072ce31782238d81301b3f4a67426e5e304dbf7db8f3d3b8d834db11e7e`.
- `eastern-dragon.webp`는 편집 전의 배색/회전 비교용이다.

## 구름

Kenney Vleugels / Kenney.nl, Particle Pack 1.1, CC0. https://kenney.nl/assets/particle-pack

기존 `/effects/titles/baekho/cloud.webp`, `cloud-soft.webp`를 공유한다. 구름38/47/58초, 안개44초 주기로 `linear` 이동한다. 독립 위상/페이드로 계속 흐르며 반전/끝점 정지가 없다. 로컬 용 정지 버튼으로 구름은 멈추지 않는다. OS 모션 감소 설정에서는 모두 정지한다.

## 이전 참고

Ouroboros — xoxoxo / Openclipart, CC0. https://commons.wikimedia.org/wiki/File:Ouroboros.svg

원본: `assets/title-effects/cheongryong/ouroboros.svg`. SHA-256: `331d435d290159af71ad2551b5e8c24267d42c856725c5507f5385bb89877808`.
