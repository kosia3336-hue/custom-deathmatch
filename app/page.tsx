/*
  '/' 는 소개를 그대로 보여준다.

  분기는 middleware 가 한다:
    비로그인 + 소개 미열람 → 여기(이 페이지)
    소개를 본 게스트, 로그인 회원      → /lobby

  예전에는 여기서도 /about 으로 넘겼는데, 그러면 브랜드 검색이 가장 먼저
  매칭될 대표 주소인 '/' 가 색인 대상에서 빠진다. 실제로 Search Console 에
  색인 0건이 찍혔다.

  /about 과 같은 화면·같은 메타데이터를 쓴다. canonical·og:url 이 '/about' 이라
  두 주소는 검색엔진에서 '/about' 한 페이지로 합쳐진다.
*/
export { metadata, viewport, default } from './about/page';
