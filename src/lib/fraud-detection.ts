/**
 * Fraud detection.
 *
 * A scan pass reads recent activity, scores a set of deterministic signals, and
 * upserts `fraud_reports` rows (deduped by fingerprint) plus a critical
 * `security_events` alert for the admin dashboard. It is rule-based, so it costs
 * nothing to run and produces explainable evidence.
 *
 * Triggered on demand from the admin security screen and opportunistically from
 * the analytics background job.
 */
import { createRecord, invalidateTable, listPage, listTable, patchRecord } from "./insforge-crud";
import { logAudit } from "./audit-api";
import { recordSecurityEvent } from "./security-api";

export const FRAUD_TABLE = "fraud_reports";

export type FraudKind =
  | "multiple_accounts" | "referral_abuse" | "coupon_abuse" | "wallet_abuse"
  | "failed_logins" | "suspicious_device" | "impossible_location"
  | "fake_restaurant" | "fake_rider" | "order_cancellations" | "bulk_signup";

export type FraudSeverity = "low" | "medium" | "high" | "critical";

export type FraudReportRow = {
  id: string;
  kind?: string; subject_type?: string; subject_id?: string; subject_label?: string;
  risk_score?: number; severity?: string;
  signals?: string[] | null; evidence?: Record<string, unknown> | null;
  status?: string; resolution?: string; resolved_by?: string; resolved_at?: string;
  fingerprint?: string; detected_at?: string; updated_at?: string; created_at?: string;
};

export const FRAUD_LABEL: Record<FraudKind, string> = {
  multiple_accounts: "Multiple accounts",
  referral_abuse: "Referral abuse",
  coupon_abuse: "Coupon abuse",
  wallet_abuse: "Wallet abuse",
  failed_logins: "Repeated failed logins",
  suspicious_device: "Suspicious device",
  impossible_location: "Impossible location change",
  fake_restaurant: "Suspected fake restaurant",
  fake_rider: "Suspected fake rider",
  order_cancellations: "Repeated cancellations",
  bulk_signup: "Bulk signup attempt",
};

function severityFor(score: number): FraudSeverity {
  if (score >= 85) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/* ------------------------------------------------------------ persistence */

const SELECT =
  "id,kind,subject_type,subject_id,subject_label,risk_score,severity,signals,evidence," +
  "status,resolution,resolved_by,resolved_at,fingerprint,detected_at,updated_at,created_at";

export type FraudFinding = {
  kind: FraudKind;
  subjectType: string;
  subjectId: string;
  subjectLabel?: string;
  score: number;
  signals: string[];
  evidence?: Record<string, unknown>;
};

/** Insert or refresh one finding. Existing open reports are updated, not duplicated. */
export async function upsertFraudReport(f: FraudFinding): Promise<"created" | "updated"> {
  const fingerprint = `${f.kind}:${f.subjectType}:${f.subjectId}`;
  const now = new Date().toISOString();
  const existing = await listTable<FraudReportRow>(FRAUD_TABLE, {
    select: "id,status,risk_score", fingerprint: `eq.${fingerprint}`, limit: 1,
  }, { fresh: true }).catch(() => []);

  const payload = {
    kind: f.kind,
    subject_type: f.subjectType,
    subject_id: f.subjectId,
    subject_label: f.subjectLabel ?? null,
    risk_score: Math.round(Math.min(100, Math.max(0, f.score))),
    severity: severityFor(f.score),
    signals: f.signals,
    evidence: f.evidence ?? null,
    fingerprint,
    detected_at: now,
    updated_at: now,
  };

  const prev = existing[0];
  if (prev) {
    // Don't reopen something an admin already dismissed unless risk grew a lot.
    if (prev.status === "dismissed" && (prev.risk_score ?? 0) + 20 > f.score) return "updated";
    await patchRecord(FRAUD_TABLE, prev.id, { ...payload, status: prev.status === "dismissed" ? "open" : prev.status ?? "open" });
    invalidateTable(FRAUD_TABLE);
    return "updated";
  }

  await createRecord(FRAUD_TABLE, { ...payload, status: "open", created_at: now });
  invalidateTable(FRAUD_TABLE);
  await recordSecurityEvent({
    userId: f.subjectType === "user" ? f.subjectId : null,
    type: "fraud_alert",
    severity: f.score >= 60 ? "critical" : "warning",
    title: `${FRAUD_LABEL[f.kind]} detected`,
    detail: f.signals.slice(0, 3).join(" · "),
    meta: { kind: f.kind, score: f.score, subject: f.subjectId },
  });
  return "created";
}

export function listFraudReports(opts: { status?: string; kind?: FraudKind; limit?: number } = {}) {
  const params: Record<string, string | number> = {
    select: SELECT, order: "risk_score.desc", limit: opts.limit ?? 100,
  };
  if (opts.status && opts.status !== "all") params.status = `eq.${opts.status}`;
  if (opts.kind) params.kind = `eq.${opts.kind}`;
  return listTable<FraudReportRow>(FRAUD_TABLE, params, { ttl: 30 });
}

export async function resolveFraudReport(
  id: string,
  status: "investigating" | "confirmed" | "dismissed",
  actor: { id: string; role?: string },
  resolution?: string,
) {
  await patchRecord(FRAUD_TABLE, id, {
    status,
    resolution: resolution ?? null,
    resolved_by: actor.id,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  invalidateTable(FRAUD_TABLE);
  logAudit({
    action: `fraud.${status}`, category: "security", actorId: actor.id, actorRole: actor.role,
    subjectType: "fraud_report", subjectId: id, severity: "notice",
    summary: `Fraud report marked ${status}`,
  });
}

/* ----------------------------------------------------------------- signals */

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v));
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function groupCount<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = str(r[key]);
    if (!k) continue;
    const list = m.get(k) ?? [];
    list.push(r);
    m.set(k, list);
  }
  return m;
}

/** Great-circle distance in km. */
function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const since = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

/** Same device signing in to several accounts → shared/farmed accounts. */
async function scanMultipleAccounts(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("login_history", 0, 400, {
    select: "user_id,device_id,email,created_at", success: "eq.true",
    created_at: `gte.${since(24 * 14)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [deviceId, list] of groupCount(rows, "device_id")) {
    const users = new Set(list.map((r) => str(r.user_id)).filter(Boolean));
    if (users.size < 3) continue;
    const score = Math.min(100, 30 + users.size * 12);
    out.push({
      kind: "multiple_accounts", subjectType: "device", subjectId: deviceId,
      subjectLabel: `${users.size} accounts on one device`, score,
      signals: [`${users.size} distinct accounts signed in from this device`, `${list.length} logins in 14 days`],
      evidence: { users: [...users].slice(0, 20), logins: list.length },
    });
  }
  return out;
}

/** Many signups from one device/IP in a short window. */
async function scanBulkSignup(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("users", 0, 400, {
    select: "id,email,created_at,last_device_id,last_ip", created_at: `gte.${since(24)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const key of ["last_device_id", "last_ip"] as const) {
    for (const [value, list] of groupCount(rows, key)) {
      if (list.length < 5) continue;
      out.push({
        kind: "bulk_signup", subjectType: key === "last_ip" ? "ip" : "device", subjectId: value,
        subjectLabel: `${list.length} signups in 24h`, score: Math.min(100, 40 + list.length * 8),
        signals: [`${list.length} accounts created in 24 hours from the same ${key === "last_ip" ? "IP" : "device"}`],
        evidence: { accounts: list.map((r) => str(r.email)).slice(0, 20) },
      });
    }
  }
  return out;
}

/** Referral rewards concentrated on one referrer or self-referral patterns. */
async function scanReferralAbuse(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("referrals", 0, 400, {
    select: "id,referrer_id,referee_id,status,reward_amount,created_at",
    created_at: `gte.${since(24 * 30)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [referrer, list] of groupCount(rows, "referrer_id")) {
    const selfRef = list.filter((r) => str(r.referee_id) === referrer).length;
    const reward = list.reduce((s, r) => s + num(r.reward_amount), 0);
    if (list.length < 8 && !selfRef) continue;
    const score = Math.min(100, list.length * 6 + selfRef * 40);
    out.push({
      kind: "referral_abuse", subjectType: "user", subjectId: referrer,
      subjectLabel: `${list.length} referrals`, score,
      signals: [
        `${list.length} referrals in 30 days`,
        ...(selfRef ? [`${selfRef} self-referral${selfRef === 1 ? "" : "s"}`] : []),
        `₹${reward.toFixed(0)} in referral rewards`,
      ],
      evidence: { referrals: list.length, selfReferrals: selfRef, reward },
    });
  }
  return out;
}

/** One user redeeming coupons far above normal, or reusing single-use codes. */
async function scanCouponAbuse(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("coupon_usage", 0, 500, {
    select: "id,user_id,coupon_code,discount_amount,created_at",
    created_at: `gte.${since(24 * 14)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [userId, list] of groupCount(rows, "user_id")) {
    const codes = new Map<string, number>();
    for (const r of list) {
      const c = str(r.coupon_code);
      codes.set(c, (codes.get(c) ?? 0) + 1);
    }
    const repeated = [...codes.entries()].filter(([, n]) => n >= 4);
    const discount = list.reduce((s, r) => s + num(r.discount_amount), 0);
    if (list.length < 12 && !repeated.length) continue;
    out.push({
      kind: "coupon_abuse", subjectType: "user", subjectId: userId,
      subjectLabel: `${list.length} redemptions`,
      score: Math.min(100, list.length * 4 + repeated.length * 20),
      signals: [
        `${list.length} coupon redemptions in 14 days`,
        ...repeated.map(([code, n]) => `Code ${code} used ${n} times`),
      ],
      evidence: { redemptions: list.length, discount, repeated },
    });
  }
  return out;
}

/** Wallet credits without matching orders, or unusually large adjustments. */
async function scanWalletAbuse(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("wallet_transactions", 0, 500, {
    select: "id,user_id,type,direction,amount,reason,created_at",
    created_at: `gte.${since(24 * 14)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [userId, list] of groupCount(rows, "user_id")) {
    const credits = list.filter((r) => str(r.direction) === "credit" || num(r.amount) > 0);
    const total = credits.reduce((s, r) => s + Math.abs(num(r.amount)), 0);
    if (total < 5000 && credits.length < 25) continue;
    out.push({
      kind: "wallet_abuse", subjectType: "user", subjectId: userId,
      subjectLabel: `₹${total.toFixed(0)} credited`,
      score: Math.min(100, Math.round(total / 200) + credits.length * 2),
      signals: [`${credits.length} wallet credits in 14 days`, `₹${total.toFixed(0)} total credited`],
      evidence: { credits: credits.length, total },
    });
  }
  return out;
}

/** Repeated failed sign-ins per account and per IP (credential stuffing). */
async function scanFailedLogins(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("login_history", 0, 400, {
    select: "user_id,email,ip,device_id,created_at", success: "eq.false",
    created_at: `gte.${since(24)}`, order: "created_at.desc",
  }, { ttl: 60 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [email, list] of groupCount(rows, "email")) {
    if (list.length < 5) continue;
    out.push({
      kind: "failed_logins", subjectType: "user", subjectId: str(list[0].user_id) || email,
      subjectLabel: email, score: Math.min(100, list.length * 10),
      signals: [`${list.length} failed sign-ins in 24 hours`],
      evidence: { attempts: list.length, ips: [...new Set(list.map((r) => str(r.ip)))].slice(0, 10) },
    });
  }
  for (const [ip, list] of groupCount(rows, "ip")) {
    const emails = new Set(list.map((r) => str(r.email)));
    if (emails.size < 4) continue;
    out.push({
      kind: "failed_logins", subjectType: "ip", subjectId: ip,
      subjectLabel: `${emails.size} accounts targeted`, score: Math.min(100, 40 + emails.size * 10),
      signals: [`${list.length} failed sign-ins against ${emails.size} accounts from one IP`],
      evidence: { attempts: list.length, accounts: [...emails].slice(0, 15) },
    });
  }
  return out;
}

/** Devices flagged as blocked, or serving an implausible number of accounts. */
async function scanSuspiciousDevices(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("device_registry", 0, 300, {
    select: "id,device_id,user_id,label,blocked,login_count,account_count,last_ip,last_seen_at",
    order: "login_count.desc",
  }, { ttl: 120 }).catch(() => []);

  return rows
    .filter((r) => Boolean(r.blocked) || num(r.login_count) > 200)
    .map((r) => ({
      kind: "suspicious_device" as FraudKind,
      subjectType: "device",
      subjectId: str(r.device_id),
      subjectLabel: str(r.label) || str(r.device_id),
      score: Boolean(r.blocked) ? 90 : Math.min(100, 40 + Math.round(num(r.login_count) / 10)),
      signals: [
        ...(r.blocked ? ["Device is blocked but still active"] : []),
        `${num(r.login_count)} logins recorded`,
      ],
      evidence: { lastIp: str(r.last_ip), lastSeen: str(r.last_seen_at) },
    }));
}

/** Location jumps faster than physically possible for a rider. */
async function scanImpossibleLocation(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("driver_tracking", 0, 500, {
    select: "driver_id,lat,lng,created_at", created_at: `gte.${since(6)}`, order: "created_at.desc",
  }, { ttl: 60 }).catch(() => []);

  const out: FraudFinding[] = [];
  for (const [driverId, list] of groupCount(rows, "driver_id")) {
    const points = list
      .map((r) => ({ lat: num(r.lat), lng: num(r.lng), t: Date.parse(str(r.created_at)) }))
      .filter((p) => p.lat && p.lng && Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t);
    let worst = 0;
    for (let i = 1; i < points.length; i++) {
      const hours = (points[i].t - points[i - 1].t) / 3600_000;
      if (hours <= 0.001) continue;
      const km = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      worst = Math.max(worst, km / hours);
    }
    if (worst < 200) continue;
    out.push({
      kind: "impossible_location", subjectType: "driver", subjectId: driverId,
      subjectLabel: `${Math.round(worst)} km/h implied speed`,
      score: Math.min(100, 40 + Math.round(worst / 10)),
      signals: [`Implied travel speed of ${Math.round(worst)} km/h between pings`],
      evidence: { impliedSpeedKmh: Math.round(worst), pings: points.length },
    });
  }
  return out;
}

/** Restaurants that stayed unverified but are live, or have no real menu. */
async function scanFakeRestaurants(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("restaurants", 0, 300, {
    select: "id,name,status,is_active,docs_verified,bank_verified,phone,created_at",
    order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  return rows
    .filter((r) => (Boolean(r.is_active) || str(r.status) === "APPROVED") && !r.docs_verified)
    .map((r) => ({
      kind: "fake_restaurant" as FraudKind,
      subjectType: "restaurant",
      subjectId: str(r.id),
      subjectLabel: str(r.name),
      score: r.bank_verified ? 45 : 70,
      signals: [
        "Live without verified documents",
        ...(r.bank_verified ? [] : ["Bank details not verified"]),
        ...(str(r.phone) ? [] : ["No contact phone on record"]),
      ],
      evidence: { status: str(r.status), docsVerified: false, bankVerified: Boolean(r.bank_verified) },
    }));
}

/** Riders operating without verified documents. */
async function scanFakeRiders(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("drivers", 0, 300, {
    select: "id,name,status,is_online,docs_verified,phone,created_at", order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  return rows
    .filter((r) => Boolean(r.is_online) && !r.docs_verified)
    .map((r) => ({
      kind: "fake_rider" as FraudKind,
      subjectType: "driver",
      subjectId: str(r.id),
      subjectLabel: str(r.name),
      score: 65,
      signals: ["Online without verified documents", ...(str(r.phone) ? [] : ["No contact phone"])],
      evidence: { status: str(r.status) },
    }));
}

/** Users or riders cancelling far more often than the norm. */
async function scanCancellations(): Promise<FraudFinding[]> {
  const rows = await listPage<Row>("orders", 0, 500, {
    select: "id,customer_id,driver_id,status,created_at", created_at: `gte.${since(24 * 14)}`, order: "created_at.desc",
  }, { ttl: 120 }).catch(() => []);

  const cancelled = rows.filter((r) => /cancel/i.test(str(r.status)));
  const out: FraudFinding[] = [];
  for (const key of ["customer_id", "driver_id"] as const) {
    for (const [id, list] of groupCount(cancelled, key)) {
      if (list.length < 5) continue;
      const total = rows.filter((r) => str(r[key]) === id).length || list.length;
      const rate = list.length / total;
      out.push({
        kind: "order_cancellations",
        subjectType: key === "customer_id" ? "user" : "driver",
        subjectId: id,
        subjectLabel: `${list.length}/${total} cancelled`,
        score: Math.min(100, Math.round(rate * 70) + list.length * 3),
        signals: [`${list.length} cancellations out of ${total} orders (${Math.round(rate * 100)}%)`],
        evidence: { cancelled: list.length, total, rate },
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------- scan pass */

export type ScanResult = { findings: number; created: number; updated: number; byKind: Record<string, number> };

const SCANNERS = [
  scanMultipleAccounts, scanBulkSignup, scanReferralAbuse, scanCouponAbuse,
  scanWalletAbuse, scanFailedLogins, scanSuspiciousDevices, scanImpossibleLocation,
  scanFakeRestaurants, scanFakeRiders, scanCancellations,
];

/**
 * Run every detector and persist the findings. Individual scanners fail softly
 * so a missing table can never abort the whole pass.
 */
export async function runFraudScan(actor?: { id: string; role?: string }): Promise<ScanResult> {
  const results = await Promise.all(SCANNERS.map((s) => s().catch(() => [] as FraudFinding[])));
  const findings = results.flat().filter((f) => f.subjectId && f.score >= 30);

  let created = 0;
  let updated = 0;
  const byKind: Record<string, number> = {};
  // Serialised on purpose: a scan is an admin action, not a hot path, and this
  // keeps the write load flat.
  for (const f of findings.sort((a, b) => b.score - a.score).slice(0, 120)) {
    const outcome = await upsertFraudReport(f).catch(() => null);
    if (outcome === "created") created++;
    else if (outcome === "updated") updated++;
    byKind[f.kind] = (byKind[f.kind] ?? 0) + 1;
  }

  logAudit({
    action: "fraud.scan", category: "security",
    actorId: actor?.id ?? "system", actorRole: actor?.role ?? "system",
    summary: `Fraud scan: ${findings.length} finding(s), ${created} new`,
    severity: created ? "warning" : "info",
    meta: { byKind },
  });
  return { findings: findings.length, created, updated, byKind };
}
