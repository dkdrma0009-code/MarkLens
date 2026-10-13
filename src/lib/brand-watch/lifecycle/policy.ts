import { z } from "zod"
import { patternPolicySchema } from "../patterns/schemas"

// The single lifecycle policy. Engine thresholds (recencyDays, independence) come from the pattern policy;
// freshness windows are added here. Defaults follow the existing 90-day recency/meaningful-update rule.
export const lifecyclePolicySchema = patternPolicySchema.extend({
  patternFreshnessDays: z.number().int().min(1).max(730).default(90),
  snapshotFreshnessDays: z.number().int().min(1).max(730).default(90),
})
export type LifecyclePolicy = z.infer<typeof lifecyclePolicySchema>
