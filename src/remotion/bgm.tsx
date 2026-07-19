import { Audio, staticFile } from "remotion"

// 릴스·숏츠 배경음악 (무음 릴스는 도달이 나쁘다).
// ── 켜는 법 ──
// 1) 로열티프리 mp3를 assets/bgm/ 에 넣는다 (Pixabay Music·YouTube Audio Library 등 상업적 사용 허용분만).
// 2) 아래 BGM_FILE 을 그 경로로 지정한다. 예: "bgm/reel-default.mp3"
// 3) npm run shorts:deploy 로 S3 사이트 재배포 (Lambda 반영).
// 기본값 null = 무음 → 현재 렌더 출력과 100% 동일. 파일 없이 켜면 staticFile 404로 렌더가 실패하니 파일부터.
const BGM_FILE: string | null = null
const BGM_VOLUME = 0.25 // 내레이션이 없으므로 배경음악 수준으로 낮게

export function Bgm() {
  if (!BGM_FILE) return null
  return <Audio src={staticFile(BGM_FILE)} volume={BGM_VOLUME} loop />
}
