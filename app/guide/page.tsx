import { permanentRedirect } from 'next/navigation';

/*
  옛 소개 페이지 주소. 내용은 '/' 로 옮겼다.

  라우트를 지우지 않고 남겨 둔 이유: 이 URL 이 한동안 사이트맵에 실려 있었고
  외부 링크도 남아 있을 수 있다. 308(영구)로 보내면 검색엔진이 색인을 '/' 로
  옮기고 그동안 쌓인 신호도 넘어간다. 유입이 완전히 끊긴 뒤에 지우면 된다.
*/
export default function GuideRedirect() {
  permanentRedirect('/');
}
