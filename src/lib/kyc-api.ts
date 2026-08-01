/**
 * Restaurant KYC — thin, back-compatible wrapper over the generic
 * verification engine in `verification-api.ts`.
 */
import {
  DOC_CATALOG,
  fetchDocs,
  fetchLogs,
  isVerificationComplete,
  mergeDocs as mergeDocsGeneric,
  reviewDoc,
  submitDoc,
  summarize,
} from "./verification-api";
import type { Actor, KycDocDef, KycRow, KycStatus, KycSummary } from "./verification-api";

export {
  KYC_STATUS_LABEL,
  KYC_STATUS_TONE,
  REVIEW_ACTIONS,
  effectiveStatus,
  isExpired,
  normalizeStatus,
} from "./verification-api";
export type { Actor, KycAuditRow, KycDocDef, KycRow, KycStatus, KycSummary } from "./verification-api";

export const KYC_DOCS = DOC_CATALOG.restaurant;
export type KycDocType = string;

export const fetchKyc = (restaurantId: string) => fetchDocs("restaurant", restaurantId);
export const fetchKycLogs = (restaurantId: string) => fetchLogs("restaurant", restaurantId);
export const mergeDocs = (rows: KycRow[]) => mergeDocsGeneric("restaurant", rows);
export const summarizeKyc = (rows: KycRow[]): KycSummary => summarize("restaurant", rows);
export const isKycComplete = (restaurantId: string) => isVerificationComplete("restaurant", restaurantId);

export const submitKycDoc = (
  restaurantId: string,
  def: KycDocDef,
  data: { doc_number?: string | null; file_url?: string | null; expires_at?: string | null },
  existing: KycRow | null,
  actor: Actor = {},
) => submitDoc("restaurant", restaurantId, def, data, existing, actor);

export const reviewKycDoc = (
  restaurantId: string,
  def: KycDocDef,
  existing: KycRow | null,
  status: KycStatus,
  remarks: string | null,
  actor: Actor = {},
) => reviewDoc("restaurant", restaurantId, def, existing, status, remarks, actor);
