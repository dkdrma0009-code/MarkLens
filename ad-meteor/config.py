# 얼음 운석 시퀀스 — 샷 프롬프트/설정 (shotlist.md와 1:1 동기 유지)
# 프롬프트 조립 순서: 샷 프롬프트 + 운석 명세(해당 샷만) + 룩 블록 — build_prompt()가 처리

MODEL = "veo-3.1-fast-generate-preview"
ASPECT_RATIO = "9:16"   # 세로 직접 생성 — 가로 생성 후 크롭 금지
RESOLUTION = "1080p"
POLL_SEC = 10
MAX_RETRIES = 2         # 실패 시 재시도 횟수 (총 시도 = 1 + MAX_RETRIES)

# ── 공통 블록 ──

LOOK_BLOCK = (
    "Vertical 9:16 composition, main subject and key action kept within the central "
    "70% of the frame height. Cold blue palette, icy cyan highlights, deep navy "
    "shadows. Photorealistic, hyper-detailed, cinematic commercial, shallow depth of "
    "field, 24fps film look."
)

METEOR_SPEC = (
    "The ice meteor: a car-sized mass of translucent blue-white ice with glowing "
    "internal fractures and a frosted surface, slowly rotating clockwise, trailing a "
    "long blue-white glowing tail with refractive glints."
)
# S5-A: 충돌·리빌 순간이라 회전 지시 제거
METEOR_SPEC_IMPACT = METEOR_SPEC.replace("slowly rotating clockwise, ", "")

NEGATIVE_DEFAULT = (
    "rocky, lava, molten, warm tones, orange fire, cartoon, blurry, low quality, "
    "text, watermark, distorted logo"
)
# S5-B: text 계열 제거(라벨 보존과 충돌), camera shake/label distortion 추가
NEGATIVE_S5B = (
    "rocky, lava, molten, warm tones, orange fire, cartoon, blurry, low quality, "
    "camera shake, label distortion"
)

# ── 샷 프롬프트 ──

S1_PROMPT = (
    "The shot opens with the ice meteor already in frame near the top, plunging "
    "straight down through deep space along the vertical axis, a field of stars and "
    "one cold blue lens flare behind it. The camera tracks the fall with a slight "
    "lag, micro ice shards peeling off and drifting up past the lens. As the meteor "
    "accelerates, its glowing blue-white tail stretches longer, slicing the frame "
    "vertically from top to bottom. SFX: deep space rumble, soft crystalline shimmer."
)

S2_PROMPT = (
    "A star-filled night sky with the Milky Way running vertically through the "
    "frame. The ice meteor falls from the top of the frame toward the bottom, "
    "drawing a long blue-white glowing tail that slices the vertical frame in two "
    "and scatters frozen sparks. The camera tilts down smoothly to follow the "
    "descent as thin wisps of cloud drift past in the foreground, and a faint "
    "aurora glows near the bottom horizon. SFX: high-altitude wind, a rising icy "
    "whistle as it passes."
)

S3_PROMPT = (
    "Extreme close-up of the rotating ice meteor filling the vertical frame, its "
    "frosted surface and glowing internal fractures refracting cold light in slow "
    "motion. Ice shards peel off and streak upward past the top of the frame, "
    "emphasizing the fall. Then a violent speed ramp: the clockwise rotation whips "
    "faster, the tail compresses into hard vertical light streaks, and the meteor "
    "blasts downward out of the bottom of the frame. SFX: a low whoosh building "
    "into a roaring acceleration, sharp ice cracking."
)
# S3 플랜 B (1회 시도 후 램프 실패 시 교체 — 급가속은 편집 setpts로):
S3_PROMPT_PLAN_B = (
    "Extreme close-up of the rotating ice meteor filling the vertical frame, its "
    "frosted surface and glowing internal fractures refracting cold light in steady "
    "slow motion. Ice shards peel off and streak upward past the top of the frame, "
    "emphasizing the fall, the clockwise rotation calm and continuous. SFX: a low "
    "sustained whoosh, soft ice crackling."
)

S4_PROMPT = (
    "First-person POV from the falling ice meteor, the camera plunging straight "
    "down so the dive aligns perfectly with the vertical frame. Clouds streak "
    "upward past the lens, frost crystals creep inward at the frame edges, and "
    "motion blur pulls every light into vertical lines. Far below, a moonlit "
    "arctic snowfield rushes up from the bottom of the frame, growing from a pale "
    "patch into a full white landscape within seconds. SFX: screaming wind, a "
    "building roar, a deep heartbeat-like rumble."
)

S5A_PROMPT = (
    "The ice meteor slams violently into an arctic ice sheet at the bottom of the "
    "frame — snow and ice shards erupt upward, filling the vertical frame with a "
    "slow-motion blizzard of debris and freezing vapor lit by a cold blue glow "
    "from within. As the snow mist clears, a tall slim unbranded blue aluminum "
    "can rises from the glowing center of the crater, dead-center in the vertical "
    "frame and standing just over half the frame height — chilled metal beaded "
    "with water droplets, frost creeping up from its base, completely clean "
    "surface, no text, no logo. The camera pushes in slowly to a low-angle hero "
    "shot. SFX: a thunderous impact boom, then ringing silence, delicate "
    "crystalline tinkles as fragments land."
)

S5B_PROMPT = (
    "The can from the reference image stays fixed dead-center in the vertical "
    "frame, perfectly sharp, standing just over half the frame height, its label "
    "unchanged. Around it, snow mist slowly clears, freezing vapor curls off the "
    "chilled metal, ice droplets bead and slide down the surface, and slow-motion "
    "ice fragments drift and settle. A cold blue glow pulses softly from the "
    "crater below and moonlight rims the can's silhouette. The camera pushes in "
    "very slowly toward the can, no camera shake. SFX: a rumbling aftermath "
    "fading out, ringing silence, delicate crystalline tinkles."
)

# ── 샷 테이블 ──
# meteor_spec=None 이면 운석 명세를 붙이지 않는다.
# "i2v" 항목이 있는 샷은 --image 지정 시 그 프롬프트/negative로 전환된다.

SHOTS = {
    "S1": {"filename": "S1_space_wide", "prompt": S1_PROMPT,
           "meteor_spec": METEOR_SPEC, "negative": NEGATIVE_DEFAULT},
    "S2": {"filename": "S2_night_sky", "prompt": S2_PROMPT,
           "meteor_spec": METEOR_SPEC, "negative": NEGATIVE_DEFAULT},
    "S3": {"filename": "S3_closeup_ramp", "prompt": S3_PROMPT,
           "meteor_spec": METEOR_SPEC, "negative": NEGATIVE_DEFAULT},
    "S4": {"filename": "S4_pov_dive", "prompt": S4_PROMPT,
           "meteor_spec": METEOR_SPEC, "negative": NEGATIVE_DEFAULT},
    "S5": {"filename": "S5_impact_reveal", "prompt": S5A_PROMPT,
           "meteor_spec": METEOR_SPEC_IMPACT, "negative": NEGATIVE_DEFAULT,
           "i2v": {"prompt": S5B_PROMPT, "meteor_spec": None,
                   "negative": NEGATIVE_S5B}},
}


def build_prompt(shot: dict) -> str:
    """샷 프롬프트 + 운석 명세(해당 샷만) + 룩 블록 순으로 조립."""
    parts = [shot["prompt"]]
    if shot.get("meteor_spec"):
        parts.append(shot["meteor_spec"])
    parts.append(LOOK_BLOCK)
    return " ".join(parts)
