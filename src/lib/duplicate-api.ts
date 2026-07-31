/**
 * Duplicate restaurant detection + permanent audit trail.
 *
 * Detection runs against InsForge with narrow, indexed-friendly queries
 * (exact identity matches, name prefix ILIKE, lat/lng bounding box) so it
 * stays fast on thousands of rows — never a full table scan into the client.
 *
 * Every check is written to `duplicate_checks` (append-only; rows are only
 * ever updated with the admin decision, never deleted).
 */
import { createRecord, listTable, patchRecord } from "./insforge-crud";
import { getAppSettings } from "./app-settings";
import type { ManagedRestaurant } from "./manager-api";

export type DuplicateLevel = "none" | "possible" | "exact";

export type DuplicateReason =
  | "gst"
  | "fssai"
  | "pan"
  | "phone"
  | "email"
  | "bank_account"
  | "name"
  | "geo"
  | "address";

export const REASON_LABEL: Record<DuplicateReason, string> = {
  gst: "Same GST number",
  fssai: "Same FSSAI licence",
  pan: "Same PAN",
  phone: "Same mobile number",
  email: "Same email address",
  bank_account: "Same bank account",
  name: "Similar restaurant name",
  geo: "Same GPS location",
  address: "Similar address",
};

export const LEVEL_LABEL: Record<DuplicateLevel, string> = {
  none: "No match",
  possible: "Possible duplicate",
  exact: "Exact duplicate",
};

export const LEVEL_TONE: Record<DuplicateLevel, string> = {
  none: "bg-emerald-100 text-emerald-700",
  possible: "bg-amber-100 text-amber-700",
  exact: "bg-rose-100 text-rose-700",
};

export type DuplicateCandidate = {
  restaurantId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  gst?: string | null;
  fssai?: string | null;
  pan?: string | null;
  bankAccount?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  city?: string | null;
};

export type DuplicateMatch = {
  id: string;
  rst_code: string | null;
  code: string | null;
  name: string;
  owner_name: string | null;
  status: string;
  onboarding_status: string | null;
  manager_id: string | null;
  manager_name: string | null;
  created_at: string | null;
  is_live: boolean;
  is_branch: boolean;
  parent_restaurant_id: string | null;
  reasons: DuplicateReason[];
  score: number;
  distance_m: number | null;
  level: DuplicateLevel;
};

export type DuplicateResult = {
  level: DuplicateLevel;
  matches: DuplicateMatch[];
  reasons: DuplicateReason[];
  radiusM: number;
};

export type DuplicateCheckRow = {
  id: string;
  restaurant_id?: string | null;
  lead_id?: string | null;
  attempted_by?: string | null;
  attempted_by_name?: string | null;
  attempted_by_role?: string | null;
  source_app?: string | null;
  candidate?: unknown;
  level?: string | null;
  reasons?: unknown;
  matches?: unknown;
  match_count?: number | null;
  action?: string | null;
  justification?: string | null;
  decision?: string | null;
  decided_by?: string | null;
  decided_by_name?: string | null;
  admin_remarks?: string | null;
  outcome?: string | null;
  merged_into?: string | null;
  decided_at?: string | null;
  created_at?: string | null;
};

// ------------------------------------------------------------ normalising

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
const digits = (v?: string | null) => (v ?? "").replace(/\D+/g, "");
const alnum = (v?: string | null) => (v ?? "").replace(/[^a-z0-9]+/gi, "").toUpperCase();

const NOISE = new Set([
  "the", "restaurant", "restaurants", "cafe", "café", "kitchen", "hotel",
  "foods", "food", "family", "pure", "veg", "multicuisine", "and", "&", "co",
  "biryani house", "outlet", "branch",
]);

/** Comparable token signature for a restaurant name. */
export function nameKey(name?: string | null) {
  return norm(name)
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && !NOISE.has(t))
    .join(" ")
    .trim();
}

function bigrams(s: string) {
  const out: string[] = [];
  const t = s.replace(/\s+/g, " ");
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

/** Dice coefficient on character bigrams — 0..1, cheap and good for names. */
export function similarity(a: string, b: string): number {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigrams(x);
  const B = bigrams(y);
  if (!A.length || !B.length) return 0;
  const pool = new Map<string, number>();
  for (const g of A) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hits = 0;
  for (const g of B) {
    const n = pool.get(g) ?? 0;
    if (n > 0) { hits++; pool.set(g, n - 1); }
  }
  return (2 * hits) / (A.length + B.length);
}

/** Metres between two coordinates (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Configured duplicate GPS radius in metres (admin editable, app_settings). */
export function duplicateRadiusM(): number {
  const v = (getAppSettings() as unknown as Record<string, unknown>).duplicate_radius_m;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 300;
}

const SELECT =
  "id,name,rst_code,code,owner_name,owner_email,owner_phone,contact_phone,contact_email," +
  "gst_number,fssai_number,pan_number,bank_account,latitude,longitude,address,city,status," +
  "onboarding_status,manager_id,manager_name,created_at,is_live,is_branch,parent_restaurant_id,archived";

type Row = ManagedRestaurant & {
  pan_number?: string | null;
  is_live?: boolean | null;
  is_branch?: boolean | null;
  parent_restaurant_id?: string | null;
  archived?: boolean | null;
};

function orFilter(parts: string[]) {
  return parts.length ? `(${parts.join(",")})` : "";
}

// ------------------------------------------------------------- detection

/**
 * Server-side duplicate detection. Issues a handful of targeted queries in
 * parallel, then scores the union client-side.
 */
export async function detectDuplicates(c: DuplicateCandidate): Promise<DuplicateResult> {
  const radiusM = duplicateRadiusM();
  const phone = digits(c.phone);
  const email = norm(c.email);
  const gst = alnum(c.gst);
  const fssai = alnum(c.fssai);
  const pan = alnum(c.pan);
  const bank = alnum(c.bankAccount);
  const key = nameKey(c.name);

  const queries: Promise<Row[]>[] = [];

  // 1. Hard identity matches (GST / FSSAI / PAN / bank / email / phone).
  const idParts: string[] = [];
  if (gst) idParts.push(`gst_number.ilike.${gst}`);
  if (fssai) idParts.push(`fssai_number.ilike.${fssai}`);
  if (pan) idParts.push(`pan_number.ilike.${pan}`);
  if (bank) idParts.push(`bank_account.ilike.${bank}`);
  if (email) idParts.push(`owner_email.ilike.${email}`, `contact_email.ilike.${email}`);
  if (phone) {
    idParts.push(`owner_phone.ilike.*${phone.slice(-10)}`, `contact_phone.ilike.*${phone.slice(-10)}`);
  }
  if (idParts.length) {
    queries.push(listTable<Row>("restaurants", { select: SELECT, or: orFilter(idParts), limit: 50 }));
  }

  // 2. Fuzzy name — prefix + contains on the first significant token.
  const token = key.split(" ")[0];
  if (token && token.length >= 3) {
    queries.push(
      listTable<Row>("restaurants", { select: SELECT, name: `ilike.*${token}*`, limit: 60 }),
    );
  }

  // 3. Bounding box around the pinned location.
  if (typeof c.latitude === "number" && typeof c.longitude === "number") {
    const dLat = radiusM / 111_320;
    const dLng = radiusM / (111_320 * Math.max(0.2, Math.cos((c.latitude * Math.PI) / 180)));
    queries.push(
      listTable<Row>("restaurants", {
        select: SELECT,
        latitude: `gte.${c.latitude - dLat}`,
        longitude: `gte.${c.longitude - dLng}`,
        limit: 120,
      }).then((rows) =>
        rows.filter(
          (r) =>
            typeof r.latitude === "number" &&
            typeof r.longitude === "number" &&
            r.latitude <= (c.latitude as number) + dLat &&
            r.longitude <= (c.longitude as number) + dLng,
        ),
      ),
    );
  }

  const results = await Promise.all(queries);
  const byId = new Map<string, Row>();
  for (const rows of results) for (const r of rows) if (r?.id) byId.set(r.id, r);
  if (c.restaurantId) byId.delete(c.restaurantId);

  const matches: DuplicateMatch[] = [];
  for (const r of byId.values()) {
    if (r.archived) continue;
    const reasons: DuplicateReason[] = [];
    let score = 0;

    if (gst && alnum(r.gst_number) === gst) { reasons.push("gst"); score += 60; }
    if (fssai && alnum(r.fssai_number) === fssai) { reasons.push("fssai"); score += 60; }
    if (pan && alnum(r.pan_number) === pan) { reasons.push("pan"); score += 45; }
    if (bank && alnum(r.bank_account) === bank) { reasons.push("bank_account"); score += 35; }
    if (phone && [digits(r.owner_phone), digits(r.contact_phone)].some((p) => p && p.slice(-10) === phone.slice(-10))) {
      reasons.push("phone"); score += 35;
    }
    if (email && [norm(r.owner_email), norm(r.contact_email)].some((e) => e && e === email)) {
      reasons.push("email"); score += 30;
    }

    const sim = similarity(c.name, r.name ?? "");
    if (sim >= 0.72) { reasons.push("name"); score += Math.round(sim * 35); }

    let dist: number | null = null;
    if (
      typeof c.latitude === "number" && typeof c.longitude === "number" &&
      typeof r.latitude === "number" && typeof r.longitude === "number"
    ) {
      dist = distanceM({ lat: c.latitude, lng: c.longitude }, { lat: r.latitude, lng: r.longitude });
      if (dist <= radiusM) { reasons.push("geo"); score += 30; }
    }

    if (c.address && r.address && similarity(c.address, r.address) >= 0.8) {
      reasons.push("address"); score += 20;
    }

    if (!reasons.length) continue;

    const identity = reasons.some((x) => x === "gst" || x === "fssai" || x === "pan");
    const geoName = reasons.includes("geo") && reasons.includes("name");
    const level: DuplicateLevel = identity || (geoName && sim >= 0.92) ? "exact" : "possible";

    matches.push({
      id: r.id,
      rst_code: r.rst_code ?? null,
      code: r.code ?? null,
      name: r.name ?? "Untitled",
      owner_name: r.owner_name ?? null,
      status: String(r.status ?? "pending"),
      onboarding_status: (r.onboarding_status as string) ?? null,
      manager_id: r.manager_id ?? null,
      manager_name: r.manager_name ?? null,
      created_at: r.created_at ?? null,
      is_live: !!r.is_live,
      is_branch: !!r.is_branch,
      parent_restaurant_id: r.parent_restaurant_id ?? null,
      reasons,
      score,
      distance_m: dist,
      level,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  const level: DuplicateLevel = matches.some((m) => m.level === "exact")
    ? "exact"
    : matches.length
      ? "possible"
      : "none";
  const reasons = Array.from(new Set(matches.flatMap((m) => m.reasons)));
  return { level, matches, reasons, radiusM };
}

/** High-priority alert: same GST or FSSAI on an existing record. */
export function isHighPriority(result: DuplicateResult) {
  return result.reasons.includes("gst") || result.reasons.includes("fssai");
}

/** Existing live restaurants can only be duplicated with admin approval. */
export function blocksWithoutAdmin(result: DuplicateResult) {
  return result.matches.some((m) => m.is_live || m.status === "approved");
}

// ------------------------------------------------------------- audit log

export async function logDuplicateCheck(input: {
  candidate: DuplicateCandidate;
  result: DuplicateResult;
  restaurantId?: string | null;
  attemptedBy?: string | null;
  attemptedByName?: string | null;
  attemptedByRole?: string;
  sourceApp?: string;
  action: string;
  justification?: string | null;
  decision?: string;
}): Promise<DuplicateCheckRow | null> {
  const created = await createRecord<DuplicateCheckRow[] | DuplicateCheckRow>("duplicate_checks", {
    restaurant_id: input.restaurantId ?? input.candidate.restaurantId ?? null,
    attempted_by: input.attemptedBy ?? null,
    attempted_by_name: input.attemptedByName ?? null,
    attempted_by_role: input.attemptedByRole ?? "manager",
    source_app: input.sourceApp ?? "manager",
    candidate: input.candidate,
    level: input.result.level,
    reasons: input.result.reasons,
    matches: input.result.matches.map((m) => ({
      id: m.id,
      rst_code: m.rst_code,
      name: m.name,
      owner_name: m.owner_name,
      status: m.status,
      manager_id: m.manager_id,
      manager_name: m.manager_name,
      created_at: m.created_at,
      reasons: m.reasons,
      score: m.score,
      distance_m: m.distance_m,
      level: m.level,
    })),
    match_count: input.result.matches.length,
    action: input.action,
    justification: input.justification ?? null,
    decision: input.decision ?? (input.result.level === "none" ? "clear" : "pending"),
  });
  const row = Array.isArray(created) ? created[0] : created;
  return (row as DuplicateCheckRow) ?? null;
}

export async function listDuplicateChecks(params?: {
  level?: DuplicateLevel;
  decision?: string;
  managerId?: string;
  restaurantId?: string;
  limit?: number;
}): Promise<DuplicateCheckRow[]> {
  const q: Record<string, string | number> = { order: "created_at.desc", limit: params?.limit ?? 200 };
  if (params?.level) q.level = `eq.${params.level}`;
  if (params?.decision) q.decision = `eq.${params.decision}`;
  if (params?.managerId) q.attempted_by = `eq.${params.managerId}`;
  if (params?.restaurantId) q.restaurant_id = `eq.${params.restaurantId}`;
  return listTable<DuplicateCheckRow>("duplicate_checks", q);
}

export type AdminDuplicateAction =
  | "merge"
  | "reject"
  | "approve_branch"
  | "archive"
  | "dismiss";

/** Admin decision on a duplicate alert. Never deletes — always appends state. */
export async function resolveDuplicate(input: {
  check: DuplicateCheckRow;
  action: AdminDuplicateAction;
  targetRestaurantId?: string | null;
  remarks?: string;
  adminId?: string | null;
  adminName?: string | null;
}) {
  const { check, action } = input;
  const restaurantId = check.restaurant_id;

  if (restaurantId) {
    if (action === "merge" && input.targetRestaurantId) {
      await patchRecord("restaurants", restaurantId, {
        archived: true,
        archived_at: new Date().toISOString(),
        duplicate_of: input.targetRestaurantId,
        duplicate_flag: "merged",
        onboarding_status: "rejected",
        status: "rejected",
        rejection_reason: input.remarks || "Merged into an existing restaurant",
      });
    }
    if (action === "reject") {
      await patchRecord("restaurants", restaurantId, {
        onboarding_status: "rejected",
        status: "rejected",
        duplicate_flag: "rejected_duplicate",
        rejection_reason: input.remarks || "Rejected as a duplicate listing",
      });
    }
    if (action === "approve_branch") {
      await patchRecord("restaurants", restaurantId, {
        is_branch: true,
        parent_restaurant_id: input.targetRestaurantId ?? null,
        duplicate_flag: "approved_branch",
        onboarding_status: "under_review",
      });
    }
    if (action === "archive") {
      await patchRecord("restaurants", restaurantId, {
        archived: true,
        archived_at: new Date().toISOString(),
        duplicate_flag: "archived",
      });
    }
  }

  await patchRecord("duplicate_checks", check.id, {
    decision: action,
    outcome:
      action === "merge" ? "merged"
        : action === "reject" ? "rejected"
          : action === "approve_branch" ? "approved_as_branch"
            : action === "archive" ? "archived"
              : "dismissed",
    merged_into: action === "merge" ? (input.targetRestaurantId ?? null) : null,
    admin_remarks: input.remarks ?? null,
    decided_by: input.adminId ?? null,
    decided_by_name: input.adminName ?? null,
    decided_at: new Date().toISOString(),
  });
}

export function duplicateStats(rows: DuplicateCheckRow[]) {
  const by = (fn: (r: DuplicateCheckRow) => boolean) => rows.filter(fn).length;
  return {
    total: rows.length,
    exact: by((r) => r.level === "exact"),
    possible: by((r) => r.level === "possible"),
    clear: by((r) => r.level === "none"),
    pending: by((r) => (r.decision ?? "pending") === "pending" && r.level !== "none"),
    merged: by((r) => r.decision === "merge"),
    rejected: by((r) => r.decision === "reject"),
    branches: by((r) => r.decision === "approve_branch"),
    highPriority: by((r) => {
      const reasons = Array.isArray(r.reasons) ? (r.reasons as string[]) : [];
      return reasons.includes("gst") || reasons.includes("fssai");
    }),
  };
}

// --------------------------------------------------------------- branches

export const BRANCH_PREFIX = "BR-";

export function formatBranchCode(parentCode: string, n: number) {
  return `${parentCode || "RST"}${BRANCH_PREFIX}${String(Math.max(1, n)).padStart(2, "0")}`;
}

export async function listBranches(parentId: string): Promise<Row[]> {
  if (!parentId) return [];
  return listTable<Row>("restaurants", {
    parent_restaurant_id: `eq.${parentId}`,
    order: "created_at.asc",
    limit: 200,
  });
}

/** Next branch code for a parent restaurant. */
export async function nextBranchCode(parent: { id: string; rst_code?: string | null }) {
  const existing = await listBranches(parent.id);
  return formatBranchCode(parent.rst_code ?? "RST", existing.length + 1);
}
