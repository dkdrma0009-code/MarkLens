# 얼음 운석 → 얼박사 리빌 — Veo 3.1 Fast 샷리스트

> 우주에서 떨어진 얼음 운석이 북극에 충돌, 그 자리에서 캔이 드러나는 시네마틱 제품 리빌.
> 역동적·스피디. 샷당 ~8초 × 5샷 → 후반에서 컷 편집으로 ~15-20초 완성.
>
> - **화면비**: Veo는 2.39:1 미지원 → **16:9 1080p로 생성 후 1920×804 크롭** (모든 프롬프트가 상하 여유 구도 전제)
> - **레퍼런스**: `ice_meteor.png`(얼음 질감 기준), `can.png`(제품 캔) — Flow에서는 재료(ingredients) 첨부, API에서는 reference image
> - **라벨 원칙**: Veo는 로고/글자를 정확히 못 그림 → S5는 캔의 형태·재질만 묘사, **실제 로고는 후반 합성**
> - 실행 스크립트: `scripts/veo_generate.py`

## 공통 스타일 블록 (모든 샷 프롬프트 맨 앞에 그대로 붙임)

```
Photorealistic cinematic commercial, anamorphic widescreen look with generous headroom for 2.39:1 crop. Cold deep-blue palette. The ice meteor is translucent blue-white ice with glowing internal fractures, backlit by a cold lens flare, surrounded by floating micro ice shards and a long glittering icy tail. Crisp specular highlights, fast dynamic high-energy pacing.
```

일관성 핵심 키워드(샷마다 반복됨): `translucent blue-white ice` / `glowing internal fractures` / `long glittering icy tail` / `cold backlight flare` / `floating micro ice shards`

---

## S1 — 우주, 운석 등장 (와이드)

```
Deep space, wide shot. A massive translucent blue-white ice meteor with glowing internal fractures streaks diagonally across the frame from upper left toward lower right, backlit by a cold blue lens flare, trailing a long glittering icy tail and floating micro ice shards. The camera drifts slowly against its direction, creating parallax with the distant star field. The meteor accelerates as it crosses, leaving sparkling fragments hanging in the void, and exits the bottom of frame. SFX: deep space rumble, crystalline shimmer.
```

컷 포인트: 운석이 프레임 하단으로 빠져나가는 순간 → S2로 컷.

## S2 — 밤하늘, 별똥별 낙하

```
A vast night sky filled with stars, seen from high altitude above thin clouds. The translucent blue-white ice meteor falls like a shooting star, drawing a long glittering icy tail across the star field, its internal fractures glowing with cold blue light. The camera pans smoothly to track the descent as the meteor punches through a thin cloud layer, scattering frozen mist. Distant aurora tints the horizon. SFX: high-altitude wind, a rising whistle as it passes.
```

컷 포인트: 구름층을 뚫는 순간의 흰 번짐 → S3 클로즈업으로 컷 (플래시 컷 호환).

## S3 — 익스트림 클로즈업 + 스피드 램프

```
Extreme close-up of the rotating translucent blue-white ice meteor in flight, filling the frame. In slow motion, cold backlight refracts through its glowing internal fractures and frost peels off the surface in delicate streaks. Then a violent speed ramp: the rotation whips faster, the icy tail stretches into hard light streaks, and the meteor blasts forward with sudden acceleration, the camera shaking from the burst. SFX: low whoosh building into a roaring acceleration.
```

컷 포인트: 급가속으로 화면이 streak로 뭉개지는 프레임 → S4 POV로 컷 (모션 연결).

## S4 — 별똥별 1인칭 POV 급강하

```
First-person POV from the falling ice meteor plunging straight down at terrifying speed. Wisps of cloud streak past the lens, frost crystals creep inward at the frame edges, the long glittering icy tail flickers at the periphery. Far below, a moonlit arctic snowfield rushes closer, growing from a pale dot into a full white landscape, the horizon tilting as the dive steepens. The ground fills the frame just before contact. SFX: screaming wind, building roar, heartbeat-like rumble.
```

컷 포인트: 지면이 프레임을 가득 채우는 마지막 프레임 → S5 충돌 화이트 플래시로 컷.

## S5 — 충돌 + 제품 리빌 (text-to-video 버전)

```
The ice meteor slams violently into an arctic ice sheet — a massive slow-motion eruption of snow, ice shards, and freezing vapor, lit from within by a cold blue glow. As the blizzard of debris settles, a tall chilled aluminum beverage can rises slowly from the glowing center of the impact crater: deep blue metallic body with a silver bottom rim, sheathed in frost, beaded with ice droplets, no readable text on its surface. Cold vapor swirls around it, ice fragments float and fall in slow motion, moonlight rims its silhouette. The camera slowly pushes in to a low-angle hero shot of the can. SFX: thunderous impact boom, ringing silence, delicate crystalline tinkle.
```

## S5-ALT — 충돌 + 제품 리빌 (image-to-video, `can.png` 입력)

`can.png`를 재료/reference로 첨부하고 사용:

```
The product can from the reference image — kept exactly identical in shape, colors and label — rises slowly from the glowing center of a fresh impact crater in an arctic ice sheet, surrounded by settling snow, drifting freezing vapor and slow-motion ice fragments. Frost creeps up the can's surface and ice droplets bead on the metal. Moonlight and a cold blue glow from the crater rim its silhouette. The camera slowly pushes in to a low-angle hero shot, the can perfectly sharp and centered. SFX: rumbling aftermath, ringing silence, delicate crystalline tinkle.
```

> reference 첨부여도 라벨 글자는 완벽하지 않을 수 있음 — 최종 로고 선명도는 후반 합성으로 보장 (검증 패턴: 정확한 라벨은 엔드카드/합성 담당).

---

## 판정 기준 (공통)

1. 얼음 질감이 `ice_meteor.png` 기준(반투명 청백 + 내부 균열)에서 벗어나지 않는가
2. 꼬리 길이·색이 샷 간 일관적인가
3. S3 스피드 램프가 실제로 느림→급가속인가
4. S5 캔 리빌이 "솟아오름"인가 (파묻힘/굴러나옴이면 재시도)
5. 충돌 강도 — 약하면 동사 세기 올림 (`slams` → `violently slams, detonating`)
