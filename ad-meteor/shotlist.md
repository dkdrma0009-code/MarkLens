# '얼박사' 얼음 운석 시퀀스 — Veo 3.1 Fast 샷리스트

> 얼음 운석이 우주에서 떨어져 북극에 충돌, 그 자리에서 얼박사 캔이 드러나는 30~40초 광고.
> 샷별 8초 클립을 Veo 3.1 fast로 생성 → 편집으로 연결. **최종 출력: 인스타그램 릴스 9:16 세로.**
>
> - 모든 샷은 **9:16 세로로 직접 생성** (가로 생성 후 크롭 금지)
> - 레퍼런스: `ice_meteor.png`(운석 질감 기준), `can.png`(제품 캔 — S5-B 입력)
> - 실행: `generate_clips.py` + `config.py` (shotlist 확정 후 작성)

---

## [공통 스타일 블록] — 모든 샷 프롬프트의 **끝에 그대로 복사해 붙임**

```
Vertical 9:16 composition, main subject and key action kept within the central 70% of the frame height. The ice meteor: a car-sized mass of translucent blue-white ice with glowing internal fractures and a frosted surface, slowly rotating clockwise, trailing a long blue-white glowing tail with refractive glints. Cold blue palette, icy cyan highlights, deep navy shadows. Photorealistic, hyper-detailed, cinematic commercial, shallow depth of field, 24fps film look.
```

운석 일관성 명세(모든 샷 동일 기술): **차 한 대 크기 / blue-white 발광 꼬리 / 시계방향 회전.**

## [공통 부정 프롬프트] — API의 `negative_prompt` 파라미터로 전달

```
rocky, lava, molten, warm tones, orange fire, cartoon, blurry, low quality, text, watermark, distorted logo
```

> 의도: 운석이 "불타는 바위"로 흘러가는 걸 차단 (orange fire/molten/rocky) — 꼬리는 반드시 blue-white.

## [세이프존 메모]

피사체·핵심 액션은 프레임 세로 중앙 70% 안 (인스타 UI: 상단 계정명, 하단 캡션/버튼에 가림 방지).
**후반 합성되는 자막·로고도 동일한 세이프존 기준을 따른다.**

---

## S1 — 우주 와이드, 운석 수직 낙하 시작

**① Veo 프롬프트:**

```
The shot opens with the ice meteor already in frame near the top, plunging straight down through deep space along the vertical axis, a field of stars and one cold blue lens flare behind it. The camera tracks the fall with a slight lag, micro ice shards peeling off and drifting up past the lens. As the meteor accelerates, its glowing blue-white tail stretches longer, slicing the frame vertically from top to bottom. SFX: deep space rumble, soft crystalline shimmer.
```

- **② 카메라:** 수직 트래킹 다운 — 운석보다 반 박자 늦게 따라가며 속도감 강조
- **③ 사운드:** deep space rumble + crystalline shimmer (저음 울림 위에 유리질 반짝임)
- **④ 다음 샷 전환:** 꼬리 빛 번짐에서 S2 꼬리로 **match cut**
- **⑤ 길이:** 8s 생성 → 편집 사용 약 3~4s (도입 가속 구간 위주, 운석 등장은 0초부터라 앞 트림 불필요)

> ※ 릴스 규칙 반영: 빈 우주로 시작하지 않음 — **0초부터 운석이 프레임 안에 있음.**

## S2 — 밤하늘, 세로 꼬리 낙하

**① Veo 프롬프트:**

```
A star-filled night sky with the Milky Way running vertically through the frame. The ice meteor falls from the top of the frame toward the bottom, drawing a long blue-white glowing tail that slices the vertical frame in two and scatters frozen sparks. The camera tilts down smoothly to follow the descent as thin wisps of cloud drift past in the foreground, and a faint aurora glows near the bottom horizon. SFX: high-altitude wind, a rising icy whistle as it passes.
```

- **② 카메라:** 부드러운 틸트 다운 팔로우 — 꼬리가 화면을 세로로 양분하는 구도 유지
- **③ 사운드:** high-altitude wind + rising icy whistle (접근감을 소리로 빌드업)
- **④ 다음 샷 전환:** 운석에 **punch-in match cut** → S3 클로즈업
- **⑤ 길이:** 8s 생성 → 사용 약 2~3s (꼬리가 가장 길게 뻗는 중반 구간)

## S3 — 익스트림 클로즈업 + 스피드 램프

**① Veo 프롬프트:**

```
Extreme close-up of the rotating ice meteor filling the vertical frame, its frosted surface and glowing internal fractures refracting cold light in slow motion. Ice shards peel off and streak upward past the top of the frame, emphasizing the fall. Then a violent speed ramp: the clockwise rotation whips faster, the tail compresses into hard vertical light streaks, and the meteor blasts downward out of the bottom of the frame. SFX: a low whoosh building into a roaring acceleration, sharp ice cracking.
```

- **② 카메라:** 고정에 가까운 ECU — 슬로모션→급가속 스피드 램프, 마지막에 운석이 하단으로 이탈
- **③ 사운드:** low whoosh → roaring acceleration + ice cracking (램프와 동기화)
- **④ 다음 샷 전환:** 수직 light streak의 모션을 그대로 받아 S4 POV로 **motion match cut**
- **⑤ 길이:** 8s 생성 → 사용 약 3~4s (슬로모션 1.5s + 램프 1.5~2s, 앞뒤 여유 트림)

## S4 — 별똥별 1인칭 POV 수직 급강하

**① Veo 프롬프트:**

```
First-person POV from the falling ice meteor, the camera plunging straight down so the dive aligns perfectly with the vertical frame. Clouds streak upward past the lens, frost crystals creep inward at the frame edges, and motion blur pulls every light into vertical lines. Far below, a moonlit arctic snowfield rushes up from the bottom of the frame, growing from a pale patch into a full white landscape within seconds. SFX: screaming wind, a building roar, a deep heartbeat-like rumble.
```

- **② 카메라:** POV 수직 하강 — 낙하 방향과 세로 프레임 일치로 속도감 극대화
- **③ 사운드:** screaming wind + building roar + heartbeat rumble (충돌 직전 최고조)
- **④ 다음 샷 전환:** 설원이 화면을 채우는 순간 **whiteout flash cut** → S5 충돌
- **⑤ 길이:** 8s 생성 → 사용 약 2~3s (지면이 차오르는 마지막 구간만)

## S5 — 충돌 + 제품 리빌 (히어로 샷)

### S5-A — text-to-video 버전 (로고는 후반 합성)

**① Veo 프롬프트:**

```
The ice meteor slams violently into an arctic ice sheet at the bottom of the frame — snow and ice shards erupt upward, filling the vertical frame with a slow-motion blizzard of debris and freezing vapor lit by a cold blue glow from within. As the snow mist clears, a tall slim unbranded blue aluminum can rises from the glowing center of the crater, dead-center in the vertical frame and standing just over half the frame height — chilled metal beaded with water droplets, frost creeping up from its base, completely clean surface, no text, no logo. The camera pushes in slowly to a low-angle hero shot. SFX: a thunderous impact boom, then ringing silence, delicate crystalline tinkles as fragments land.
```

- **② 카메라:** 충돌 풀프레임 → 눈안개 걷히며 캔으로 슬로우 push-in, 로우앵글 마무리
- **③ 사운드:** thunderous boom → ringing silence → crystalline tinkle (3단 다이내믹)
- **④ 다음 샷 전환:** push-in 끝 프레임에서 정지 → **로고/자막 합성 + 엔드카드** (편집 단계)
- **⑤ 길이:** 8s 생성 → 사용 약 5~6s (충돌 2s + 리빌 3~4s) — 광고의 클라이맥스, 가장 길게 사용

### S5-B — image-to-video 버전 (`can.png` 입력, 라벨 보존)

**① Veo 프롬프트** (can.png를 first-frame/reference로 첨부):

```
The can from the reference image stays fixed dead-center in the vertical frame, perfectly sharp, standing just over half the frame height, its label unchanged. Around it, snow mist slowly clears, freezing vapor curls off the chilled metal, ice droplets bead and slide down the surface, and slow-motion ice fragments drift and settle. A cold blue glow pulses softly from the crater below and moonlight rims the can's silhouette. The camera pushes in very slowly toward the can, no camera shake. SFX: a rumbling aftermath fading out, ringing silence, delicate crystalline tinkles.
```

- **② 카메라:** 캔 고정 + 주변 요소(눈안개·서리·파편)만 모션, 초저속 push-in
- **③ 사운드:** rumbling aftermath 페이드 → silence → tinkle
- **④ 다음 샷 전환:** S5-A의 충돌 전반부와 이어붙임 가능 (A 충돌 0~2s → B 리빌) 또는 단독 사용
- **⑤ 길이:** 8s 생성 → 사용 약 4~6s
- **메모:** reference여도 라벨 글자가 완벽하지 않을 수 있음 — **최종 로고 선명도는 후반 합성이 보장** (검증된 패턴: 정확한 라벨은 합성/엔드카드 담당)

---

## 편집 설계 요약 (참고)

| 순서 | 샷 | 사용 길이 | 전환 |
|---|---|---|---|
| 1 | S1 | ~3-4s | match cut (꼬리) |
| 2 | S2 | ~2-3s | punch-in match cut |
| 3 | S3 | ~3-4s | motion match cut |
| 4 | S4 | ~2-3s | whiteout flash |
| 5 | S5 | ~5-6s | 정지 → 로고 합성·엔드카드 |
| | **합계** | **~15-20s 본편** + 엔드카드 | 30~40초 목표 시 S1/S3/S5 사용 구간 확대 |

## 판정 기준

1. 운석 질감이 `ice_meteor.png` 기준(반투명 청백 + 내부 균열 + 서리 표면)인가 — 바위/용암이면 즉시 재시도
2. 꼬리가 **blue-white**이고 샷 간 길이·색 일관적인가 (orange면 negative 강화)
3. 세로 동선 — 낙하·폭발·리빌이 모두 수직축을 타는가
4. S3 스피드 램프가 실제로 느림→급가속인가
5. S5 캔이 "솟아오름" + 프레임 높이 50~60% 히어로 구도인가
6. 피사체가 세로 중앙 70% 세이프존 안에 있는가
