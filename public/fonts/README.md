# public/fonts — Remotion Player(어드민 릴스 미리보기) 전용 사본

`assets/fonts/` 의 Pretendard 3종 사본이다. **지우지 말 것.**

## 왜 두 벌인가

컴포지션이 `staticFile("fonts/Pretendard-*.otf")` 로 폰트를 부르는데,
`staticFile()` 이 가리키는 곳이 실행 환경마다 다르다.

| 환경 | staticFile 기준 | 필요한 위치 |
|---|---|---|
| Lambda 렌더 / 로컬 CLI 렌더 | `publicDir` = `assets/` | `assets/fonts/` |
| 브라우저 Remotion Player | Next 정적 루트 = `public/` | `public/fonts/` |

한쪽만 있으면 그쪽에서만 한글이 나오고 다른 쪽은 폴백 폰트로 깨진다.
미리보기가 실제 렌더와 달라지면 미리보기의 존재 의미가 없으므로 둘 다 둔다.

## 왜 `assets/` 를 `public/` 으로 옮기지 않았나

`assets/fonts/` 는 Remotion 전용이 아니다. 옮기면 아래가 깨진다.

- `src/lib/cardnews/fonts.ts` — Satori 카드뉴스 이미지 렌더가 `fs` 로 직접 읽음
- `next.config.ts` 의 `outputFileTracingIncludes` — API 라우트 6개가 서버리스
  번들에 이 경로를 포함시킴 (`public/` 은 정적 자산이라 취급이 다름)

미리보기 하나 때문에 프로덕션 이미지 생성을 위험에 빠뜨릴 이유가 없다.

## 동기화

폰트 파일을 교체할 일이 생기면 **양쪽 다** 바꿔야 한다.
Pretendard 는 고정 자산이라 실제로 바뀔 일은 거의 없다.
Playfair 는 광고 템플릿 전용이고 릴스 컴포지션에서 안 쓰므로 복사하지 않았다.
