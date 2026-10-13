import { numericTokens, normalizeSupport } from "../evidence/support"
import { detectEntityCandidates } from "../sources/candidates"

// Lexical guard for an interpretation layer: hypotheses are allowed, asserted certainty and specifics
// absent from the reviewed input are not. Heuristic only; human review remains mandatory.
const STRATEGIC_CERTAINTY = /목표로\s?(?:하고\s?있|한다|삼고)|의도(?:는|가|이다|했|하고)|노리고\s?있|겨냥하고\s?있|(?:하려|하기로)\s?(?:한다|했다|결정)|\b(?:aims? to|intends? to|is targeting|plans? to|is determined to|its strategy is)\b/i
const CONSUMER_CERTAINTY = /소비자(?:들)?(?:은|는|이|가)\s?(?:\S+\s?){0,4}(?:원한다|원하고|선호한다|느낀다|좋아한다)|\bconsumers (?:want|prefer|feel|love|demand)\b/i
const FUTURE_CERTAINTY = /할\s?것이다|될\s?것이다|확실히|분명히|반드시|틀림없|입증|(?<!\b(?:whether|if)\b[^.?!]{0,60})\bwill\b|\bdefinitely\b|\bcertainly\b|\bproves?\b|\bguarantee/i
const BUSINESS_OUTCOME = /매출|수익|판매량|거래액|\brevenue\b|\bsales\b|\bprofit|\bGMV\b|\bROI\b/i
const MARKET_CLAIM = /점유율|1위|시장\s?규모|market (?:share|leader|size)|\bnumber one\b|\bno\. ?1\b/i
const COMPETITOR = /경쟁사|경쟁 업체|\bcompetitors?\b|\brivals?\b/i
const HEDGE = /수\s?있|가능성|보인다|것으로 보|\bmay\b|\bmight\b|\bcould\b|\bpossibly\b|\bsuggests?\b|\bappears?\b|\blikely\b/i

export function validateTakeClaims(take: { whatWeSee: string; whyItMayMatter: string; whatToWatchNext: string }, corpus: readonly string[], entityId: string) {
  const issues: string[] = [], all = [take.whatWeSee, take.whyItMayMatter, take.whatToWatchNext].join("\n"), source = normalizeSupport(corpus.join("\n"))
  const supportedNumbers = new Set(numericTokens(source))
  if (numericTokens(all).some(number => !supportedNumbers.has(number))) issues.push("UNSUPPORTED_NUMBER")
  if (STRATEGIC_CERTAINTY.test(all)) issues.push("UNSUPPORTED_STRATEGIC_CERTAINTY")
  if (CONSUMER_CERTAINTY.test(all)) issues.push("UNSUPPORTED_CONSUMER_CERTAINTY")
  if (FUTURE_CERTAINTY.test(all)) issues.push("UNSUPPORTED_FUTURE_CERTAINTY")
  // Outcome, market and competitor specifics are allowed only when the reviewed input contains them.
  if (BUSINESS_OUTCOME.test(all) && !BUSINESS_OUTCOME.test(source)) issues.push("UNSUPPORTED_BUSINESS_OUTCOME")
  if (MARKET_CLAIM.test(all) && !MARKET_CLAIM.test(source)) issues.push("UNSUPPORTED_MARKET_CLAIM")
  const inputEntities = new Set(detectEntityCandidates("", source).map(row => row.entityId))
  if ((COMPETITOR.test(all) && !COMPETITOR.test(source)) || detectEntityCandidates("", all).some(row => row.entityId !== entityId && !inputEntities.has(row.entityId))) issues.push("UNSUPPORTED_COMPETITOR_CLAIM")
  // WHY IT MAY MATTER is MarkLens interpretation and must be stated as a possibility.
  if (!HEDGE.test(take.whyItMayMatter)) issues.push("UNHEDGED_INTERPRETATION")
  return issues
}
