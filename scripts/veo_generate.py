#!/usr/bin/env python3
"""Veo 3.1 Fast 샷 일괄 생성 골격 — docs/ad-ice-meteor-shotlist.md의 S1~S5.

사용:
  pip install google-genai
  python scripts/veo_generate.py --out ad-work/meteor                  # S1~S5 전부
  python scripts/veo_generate.py --out ad-work/meteor --shots S3,S5    # 일부만
  python scripts/veo_generate.py --out ad-work/meteor --can ad-work/meteor/can.png
      # --can 지정 시 S5가 image-to-video(S5-ALT 프롬프트)로 전환

API 키: 환경변수 VEO_API_KEY(또는 GOOGLE_API_KEY/GEMINI_API_KEY) → 없으면 .env.local의
VEO_API_KEY를 읽는다. 키는 절대 출력하지 않는다.

주의: Veo 모델명·SDK 표면은 프리뷰 단계라 바뀔 수 있다. 호출 실패 시
https://ai.google.dev/gemini-api/docs/video 의 최신 시그니처 확인.
"""

import argparse
import os
import pathlib
import sys
import time

MODEL = "veo-3.1-fast-generate-preview"
ASPECT = "16:9"      # 2.39:1 미지원 — 16:9 생성 후 후반에서 1920x804 크롭
RESOLUTION = "1080p"
POLL_SEC = 10

STYLE = (
    "Photorealistic cinematic commercial, anamorphic widescreen look with generous "
    "headroom for 2.39:1 crop. Cold deep-blue palette. The ice meteor is translucent "
    "blue-white ice with glowing internal fractures, backlit by a cold lens flare, "
    "surrounded by floating micro ice shards and a long glittering icy tail. Crisp "
    "specular highlights, fast dynamic high-energy pacing."
)

SHOTS = {
    "S1": (
        "Deep space, wide shot. A massive translucent blue-white ice meteor with glowing "
        "internal fractures streaks diagonally across the frame from upper left toward "
        "lower right, backlit by a cold blue lens flare, trailing a long glittering icy "
        "tail and floating micro ice shards. The camera drifts slowly against its "
        "direction, creating parallax with the distant star field. The meteor accelerates "
        "as it crosses, leaving sparkling fragments hanging in the void, and exits the "
        "bottom of frame. SFX: deep space rumble, crystalline shimmer."
    ),
    "S2": (
        "A vast night sky filled with stars, seen from high altitude above thin clouds. "
        "The translucent blue-white ice meteor falls like a shooting star, drawing a long "
        "glittering icy tail across the star field, its internal fractures glowing with "
        "cold blue light. The camera pans smoothly to track the descent as the meteor "
        "punches through a thin cloud layer, scattering frozen mist. Distant aurora tints "
        "the horizon. SFX: high-altitude wind, a rising whistle as it passes."
    ),
    "S3": (
        "Extreme close-up of the rotating translucent blue-white ice meteor in flight, "
        "filling the frame. In slow motion, cold backlight refracts through its glowing "
        "internal fractures and frost peels off the surface in delicate streaks. Then a "
        "violent speed ramp: the rotation whips faster, the icy tail stretches into hard "
        "light streaks, and the meteor blasts forward with sudden acceleration, the "
        "camera shaking from the burst. SFX: low whoosh building into a roaring "
        "acceleration."
    ),
    "S4": (
        "First-person POV from the falling ice meteor plunging straight down at "
        "terrifying speed. Wisps of cloud streak past the lens, frost crystals creep "
        "inward at the frame edges, the long glittering icy tail flickers at the "
        "periphery. Far below, a moonlit arctic snowfield rushes closer, growing from a "
        "pale dot into a full white landscape, the horizon tilting as the dive steepens. "
        "The ground fills the frame just before contact. SFX: screaming wind, building "
        "roar, heartbeat-like rumble."
    ),
    "S5": (
        "The ice meteor slams violently into an arctic ice sheet — a massive slow-motion "
        "eruption of snow, ice shards, and freezing vapor, lit from within by a cold blue "
        "glow. As the blizzard of debris settles, a tall chilled aluminum beverage can "
        "rises slowly from the glowing center of the impact crater: deep blue metallic "
        "body with a silver bottom rim, sheathed in frost, beaded with ice droplets, no "
        "readable text on its surface. Cold vapor swirls around it, ice fragments float "
        "and fall in slow motion, moonlight rims its silhouette. The camera slowly pushes "
        "in to a low-angle hero shot of the can. SFX: thunderous impact boom, ringing "
        "silence, delicate crystalline tinkle."
    ),
}

# --can 지정 시 S5 대신 사용 (image-to-video — 캔 레퍼런스 유지)
S5_I2V = (
    "The product can from the reference image — kept exactly identical in shape, colors "
    "and label — rises slowly from the glowing center of a fresh impact crater in an "
    "arctic ice sheet, surrounded by settling snow, drifting freezing vapor and "
    "slow-motion ice fragments. Frost creeps up the can's surface and ice droplets bead "
    "on the metal. Moonlight and a cold blue glow from the crater rim its silhouette. "
    "The camera slowly pushes in to a low-angle hero shot, the can perfectly sharp and "
    "centered. SFX: rumbling aftermath, ringing silence, delicate crystalline tinkle."
)


def load_api_key() -> str:
    for name in ("VEO_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"):
        if os.environ.get(name):
            return os.environ[name]
    env = pathlib.Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            if line.startswith("VEO_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"')
    sys.exit("VEO_API_KEY가 없습니다 — 환경변수 또는 .env.local에 설정하세요")


def generate_shot(client, shot_id: str, prompt: str, out_dir: pathlib.Path,
                  can_path: pathlib.Path | None = None) -> pathlib.Path:
    from google.genai import types

    kwargs = {}
    if can_path is not None:
        kwargs["image"] = types.Image.from_file(location=str(can_path))

    print(f"[{shot_id}] 생성 요청...")
    operation = client.models.generate_videos(
        model=MODEL,
        prompt=f"{STYLE} {prompt}",
        config=types.GenerateVideosConfig(
            aspect_ratio=ASPECT,
            resolution=RESOLUTION,
        ),
        **kwargs,
    )
    while not operation.done:
        time.sleep(POLL_SEC)
        operation = client.operations.get(operation)
        print(f"[{shot_id}] 대기 중...")

    if operation.error:
        raise RuntimeError(f"{shot_id} 실패: {operation.error}")

    video = operation.response.generated_videos[0]
    client.files.download(file=video.video)
    out_path = out_dir / f"{shot_id}.mp4"
    video.video.save(str(out_path))
    print(f"[{shot_id}] 저장: {out_path}")
    return out_path


def main() -> None:
    ap = argparse.ArgumentParser(description="Veo 3.1 Fast 샷 일괄 생성")
    ap.add_argument("--out", required=True, help="출력 디렉토리 (예: ad-work/meteor)")
    ap.add_argument("--shots", default=",".join(SHOTS),
                    help="생성할 샷 (예: S1,S3,S5 — 기본 전부)")
    ap.add_argument("--can", default=None,
                    help="can.png 경로 — 지정 시 S5가 image-to-video(S5-ALT)로 전환")
    args = ap.parse_args()

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    can_path = pathlib.Path(args.can) if args.can else None
    if can_path is not None and not can_path.exists():
        sys.exit(f"--can 파일 없음: {can_path}")

    wanted = [s.strip().upper() for s in args.shots.split(",") if s.strip()]
    unknown = [s for s in wanted if s not in SHOTS]
    if unknown:
        sys.exit(f"알 수 없는 샷: {unknown} (가능: {', '.join(SHOTS)})")

    from google import genai
    client = genai.Client(api_key=load_api_key())

    results, failures = [], []
    for shot_id in wanted:  # 순차 실행 — S1~S5 파일명 자동 정리
        prompt = S5_I2V if (shot_id == "S5" and can_path) else SHOTS[shot_id]
        try:
            results.append(generate_shot(
                client, shot_id, prompt, out_dir,
                can_path=can_path if shot_id == "S5" else None,
            ))
        except Exception as e:  # 한 샷 실패해도 나머지는 계속
            print(f"[{shot_id}] 오류: {e}", file=sys.stderr)
            failures.append(shot_id)

    print(f"\n완료 {len(results)}개: " + ", ".join(p.name for p in results))
    if failures:
        sys.exit(f"실패 {len(failures)}개: {', '.join(failures)} — 해당 샷만 --shots로 재시도")


if __name__ == "__main__":
    main()
