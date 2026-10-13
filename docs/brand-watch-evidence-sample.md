# Synthetic intelligence trace

This example is exercised by `tests/brand-watch-intelligence.test.mjs`. It is fixture data, not a statement about actual TOSS activity.

| Source | Extracted candidate fact | Supporting span |
| --- | --- | --- |
| Official synthetic announcement | TOSS launched Signal Week | “On 2026-10-01, TOSS launched the Signal Week campaign in Korea.” |
| Same announcement | TOSS invited creator Yuna | “On 2026-10-01, TOSS invited creator Yuna to the Signal Week campaign.” |
| Synthetic media report | TOSS launched Signal Week | “TOSS launched Signal Week on 2026-10-01.” |

Each Evidence retains source-item UUID, content hash, normalized support locator, provider/model and prompt/pipeline versions. Two official-source facts form one named-event candidate. A matching media candidate can attach its Evidence to that same unreviewed candidate because entity, named event, type and explicit event day match.

Result: **one Movement candidate, three Evidence candidates, two source documents**, all `needs_review`. Documents are not automatically counted as two independent sources: the separate independence assessment remains review-required. A copied release is NOT_INDEPENDENT even on a different provider URL. Nothing is approved, published or written to production.
