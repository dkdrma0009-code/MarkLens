// Synthetic copy for local QA only. Numeric examples are not publication claims.
const photo = {
  category: "캠페인",
  slides: [
    { type: "cover", role: "hook", headline: ["브랜드가", "광고 밖으로", "나오는 순간"], photoCrop: true },
    { type: "fact", role: "what", body: "브랜드가 제품 설명 대신 사람들이 직접 경험할 수 있는 캠페인을 선보였습니다.", source: "Local QA fixture" },
    { type: "why", role: "context", headline: "광고보다 경험", body: "소비자가 참여한 장면이 콘텐츠가 되고, 브랜드 메시지는 그 경험을 통해 전달됩니다." },
    { type: "why", role: "why", headline: "참여가 기억을 만든다", body: "메시지를 보는 것과 직접 행동하는 것은 다릅니다. 캠페인은 그 차이를 활용합니다." },
    { type: "why", role: "take", headline: "설명보다 장면을 설계하라", body: "참여가 목적이 되어서는 안 됩니다. 경험한 뒤 어떤 브랜드 의미를 기억할지 먼저 정해야 합니다." },
    { type: "apply", role: "action", body: "기억할 브랜드 의미를 하나 정하세요.\n고객이 직접 행동할 장면을 설계하세요.\n참여 이후의 반응을 확인하세요." },
    { type: "cta", role: "end", headline: "트렌드를 읽고,\n실무를 준비하다.", body: "Marketing × Trend × Intelligence" },
  ],
}
const data = structuredClone(photo)
data.category = "데이터"
data.slides[0].headline = ["고객의 선택은", "어디서 시작될까"]
data.slides[1].body = "고객의 탐색 경로를 조사해 콘텐츠 접점을 살펴봤습니다."
data.slides[2].headline = "검색 이전의 발견"
data.slides[2].body = "응답자의 84%는 제품을 검색하기 전에 콘텐츠를 통해 처음 발견했습니다."
data.slides[3].headline = "발견 경로가 바뀐다"
data.slides[3].body = "탐색은 검색창에서만 시작되지 않습니다. 브랜드는 고객의 첫 접점을 다시 살펴야 합니다."
data.slides[4].headline = "검색 전에 이유를 만들어라"
data.slides[4].body = "전환 채널만 최적화하면 발견의 순간을 놓칩니다. 먼저 관심이 생기는 맥락을 설계해야 합니다."
data.slides[5].body = "첫 발견 채널을 고객에게 물어보세요.\n발견 콘텐츠와 전환 콘텐츠를 구분하세요.\n두 접점의 연결을 확인하세요."
const typography = structuredClone(photo)
typography.category = "커리어 / 전략"
typography.slides = typography.slides.filter(s => s.role !== "context" && s.role !== "end")
typography.slides[0].headline = ["포트폴리오에", "결과만", "넣지 마세요"]
typography.slides[1].body = "포트폴리오를 볼 때는 결과와 함께 어떤 판단을 했는지도 확인합니다."
typography.slides[2].headline = "판단 과정이 실력이다"
typography.slides[2].body = "완성된 산출물만으로는 문제를 정의하고 대안을 선택한 과정을 이해하기 어렵습니다."
typography.slides[3].headline = "선택의 이유를 보여주세요"
typography.slides[3].body = "무엇을 만들었는지보다 왜 그 방법을 골랐는지가 다음 프로젝트의 가능성을 보여줍니다."
typography.slides[4].body = "해결하려던 문제를 먼저 적으세요.\n고려했던 대안과 선택 이유를 남기세요.\n결과에서 배운 점을 정리하세요."
const trend = structuredClone(photo)
trend.category = "소셜 미디어"
trend.slides[0].headline = ["콘텐츠가", "브랜드의", "첫인상이 된다"]
trend.slides = trend.slides.filter(s => s.role !== "context")
const noImage = structuredClone(trend)
noImage.category = "AI 마케팅"
const long = structuredClone(photo)
long.slides[0].headline = ["세계적인브랜드가새로운캠페인으로고객과만나는방식을바꾸는아주긴한국어제목", 'InternationalBrandName2026 "크리에이터" 123,456,789%', "긴 제목의 안전한 표시를 확인합니다"]
const missing = structuredClone(typography)
delete missing.slides[0].sub
delete missing.slides[0].highlight
delete missing.slides[1].source
const legacy = structuredClone(photo)
legacy.slides = [legacy.slides[0], legacy.slides[1], legacy.slides[3], legacy.slides[5],
  { type: "keywords", keywords: [{ word: "경험 설계", desc: "참여 이후 남는 브랜드 의미" }, { word: "콘텐츠", desc: "고객의 행동이 만드는 메시지" }] }, legacy.slides[6]]
legacy.slides.forEach(s => { delete s.role })
const fullImage = structuredClone(photo)
delete fullImage.slides[0].photoCrop
const longData = structuredClone(data)
longData.slides[2].body = "프로그램에 참여한 고객은 123,456,789명으로 집계됐습니다."
module.exports = { photo, data, typography, trend, noImage, long, missing, legacy, fullImage, longData }
