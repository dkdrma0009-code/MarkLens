import type { z } from "zod"
import type { entitySchema, sourceSchema, evidenceSchema, movementSchema, themeSchema, patternSchema, takeSchema, snapshotSchema, auditSchema, lineageSchema } from "./schemas"

export type BrandEntity = z.infer<typeof entitySchema>
export type Source = z.infer<typeof sourceSchema>
export type Evidence = z.infer<typeof evidenceSchema>
export type Movement = z.infer<typeof movementSchema>
export type Theme = z.infer<typeof themeSchema>
export type Pattern = z.infer<typeof patternSchema>
export type Take = z.infer<typeof takeSchema>
export type Snapshot = z.infer<typeof snapshotSchema>
export type AuditEvent = z.infer<typeof auditSchema>
export type Lineage = z.infer<typeof lineageSchema>
