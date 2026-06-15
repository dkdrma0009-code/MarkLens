import { Composition } from "remotion"
import { ShortsComposition, calcShortsMetadata, defaultShortsProps, FPS } from "./ShortsComposition"

// 숏츠 컴포지션 등록 — durationInFrames는 calcShortsMetadata가 슬라이드 수로 덮어씀
export function RemotionRoot() {
  return (
    <Composition
      id="Shorts"
      component={ShortsComposition}
      durationInFrames={540}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={defaultShortsProps}
      calculateMetadata={calcShortsMetadata}
    />
  )
}
