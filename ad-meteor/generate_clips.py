#!/usr/bin/env python3
"""Veo 3.1 fast 샷 일괄 생성 — ad-meteor/shotlist.md 구현.

사용:
  pip install google-genai
  python ad-meteor/generate_clips.py --out ad-work/meteor              # S1~S5 전부
  python ad-meteor/generate_clips.py --out ad-work/meteor --shot S3    # 단일 샷 재생성
  python ad-meteor/generate_clips.py --out ad-work/meteor --shot S5 --image ad-work/meteor/can.png
      # --image 지정 시 S5가 image-to-video(S5-B 프롬프트·전용 negative)로 전환

API 키: 환경변수 GOOGLE_API_KEY → VEO_API_KEY → GEMINI_API_KEY → .env.local의
VEO_API_KEY 순으로 탐색. 하드코딩 금지, 키는 출력하지 않는다.

주의: Veo 모델명·SDK 표면은 프리뷰 단계라 바뀔 수 있다. 호출 실패 시
https://ai.google.dev/gemini-api/docs/video 의 최신 시그니처 확인.
"""

import argparse
import pathlib
import sys
import time
import os

import config


def load_api_key() -> str:
    for name in ("GOOGLE_API_KEY", "VEO_API_KEY", "GEMINI_API_KEY"):
        if os.environ.get(name):
            return os.environ[name]
    env = pathlib.Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        for line in env.read_text(encoding="utf-8-sig").splitlines():
            for name in ("VEO_API_KEY", "GOOGLE_API_KEY"):
                if line.startswith(name + "="):
                    return line.split("=", 1)[1].strip().strip('"')
    sys.exit("API 키가 없습니다 — GOOGLE_API_KEY 환경변수 또는 .env.local에 설정하세요")


def log_error(out_dir: pathlib.Path, msg: str) -> None:
    print(msg, file=sys.stderr)
    with open(out_dir / "generate_errors.log", "a", encoding="utf-8") as f:
        f.write(time.strftime("[%Y-%m-%d %H:%M:%S] ") + msg + "\n")


def generate_once(client, shot_id: str, prompt: str, negative: str,
                  out_path: pathlib.Path, image_path: pathlib.Path | None) -> None:
    from google.genai import types

    kwargs = {}
    if image_path is not None:
        kwargs["image"] = types.Image.from_file(location=str(image_path))

    operation = client.models.generate_videos(
        model=config.MODEL,
        prompt=prompt,
        config=types.GenerateVideosConfig(
            aspect_ratio=config.ASPECT_RATIO,
            resolution=config.RESOLUTION,
            negative_prompt=negative,
        ),
        **kwargs,
    )
    while not operation.done:
        time.sleep(config.POLL_SEC)
        operation = client.operations.get(operation)
        print(f"[{shot_id}] 생성 대기 중...")

    if operation.error:
        raise RuntimeError(str(operation.error))

    video = operation.response.generated_videos[0]
    client.files.download(file=video.video)
    video.video.save(str(out_path))


def generate_shot(client, shot_id: str, out_dir: pathlib.Path,
                  image_path: pathlib.Path | None) -> pathlib.Path:
    spec = config.SHOTS[shot_id]
    use_i2v = image_path is not None and "i2v" in spec
    src = spec["i2v"] if use_i2v else spec
    prompt = config.build_prompt(src)
    negative = src["negative"]
    out_path = out_dir / f"{spec['filename']}.mp4"

    mode = "image-to-video" if use_i2v else "text-to-video"
    print(f"[{shot_id}] {mode} 생성 시작 → {out_path.name}")

    last_err = None
    for attempt in range(1 + config.MAX_RETRIES):
        try:
            generate_once(client, shot_id, prompt, negative, out_path,
                          image_path if use_i2v else None)
            print(f"[{shot_id}] 저장 완료: {out_path}")
            return out_path
        except Exception as e:  # noqa: BLE001 — 어떤 실패든 재시도 대상
            last_err = e
            log_error(out_dir, f"{shot_id} 시도 {attempt + 1} 실패: {e}")
            if attempt < config.MAX_RETRIES:
                time.sleep(5)
    raise RuntimeError(f"{shot_id} 최종 실패 (시도 {1 + config.MAX_RETRIES}회): {last_err}")


def main() -> None:
    ap = argparse.ArgumentParser(description="얼음 운석 시퀀스 — Veo 3.1 fast 클립 생성")
    ap.add_argument("--out", default="ad-work/meteor", help="출력 디렉토리")
    ap.add_argument("--shot", default=None,
                    help="단일/일부 샷만 (예: S3 또는 S1,S4 — 기본 전부)")
    ap.add_argument("--image", default=None,
                    help="can.png 경로 — 지정 시 S5가 image-to-video(S5-B)로 전환")
    args = ap.parse_args()

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    image_path = pathlib.Path(args.image) if args.image else None
    if image_path is not None and not image_path.exists():
        sys.exit(f"--image 파일 없음: {image_path}")

    wanted = ([s.strip().upper() for s in args.shot.split(",") if s.strip()]
              if args.shot else list(config.SHOTS))
    unknown = [s for s in wanted if s not in config.SHOTS]
    if unknown:
        sys.exit(f"알 수 없는 샷: {unknown} (가능: {', '.join(config.SHOTS)})")

    from google import genai
    client = genai.Client(api_key=load_api_key())

    done, failed = [], []
    for shot_id in wanted:  # 순차 실행 — S1~S5 파일명 자동 정리
        try:
            done.append(generate_shot(client, shot_id, out_dir, image_path))
        except Exception as e:  # noqa: BLE001
            log_error(out_dir, str(e))
            failed.append(shot_id)

    print(f"\n완료 {len(done)}개: " + ", ".join(p.name for p in done))
    if failed:
        sys.exit(f"실패 {len(failed)}개: {', '.join(failed)} — `--shot {','.join(failed)}`로 재시도")


if __name__ == "__main__":
    main()
