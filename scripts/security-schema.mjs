/**
 * One-off schema migration for the Scoobix Security, Permissions & Audit system.
 * Run with: INSFORGE_API_KEY=... node scripts/security-schema.mjs
 */
const URL_BASE = "https://awvs3seh.us-east.insforge.app";
const KEY = process.env.INSFORGE_API_KEY;
if (!KEY) throw new Error("INSFORGE_API_KEY missing");

const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const col = (columnName, type, extra = {}) => ({
  columnName, type, isNullable: true, isUnique: false, ...extra,
});
const pk = () => col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" });
const createdAt = () => col("created_at", "datetime", { defaultValue: "now()" });

async function api(path, method, body) {
  const res = await fetch(`${URL_BASE}${path}`, {
    method, headers: H, body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, body: txt.slice(0, 400) };
}

const existing = await (await fetch(`${URL_BASE}/api/database/tables`, { headers: H })).json();

async function ensureTable(tableName, columns) {
  if (existing.includes(tableName)) {
    const schema = await (await fetch(`${URL_BASE}/api/database/tables/${tableName}/schema`, { headers: H })).json();
    const have = new Set(schema.columns.map((c) => c.columnName));
    const missing = columns.filter((c) => !have.has(c.columnName));
    if (!missing.length) { console.log(`= ${tableName} up to date`); return; }
    const r = await api(`/api/database/tables/${tableName}/schema`, "PATCH", { addColumns: missing });
    console.log(`+ ${tableName} add ${missing.map((m) => m.columnName).join(",")} → ${r.status} ${r.ok ? "" : r.body}`);
    return;
  }
  const r = await api(`/api/database/tables`, "POST", { tableName, columns, rlsEnabled: false });
  console.log(`* create ${tableName} → ${r.status} ${r.ok ? "" : r.body}`);
}

/* ------------------------------------------------------------ audit_logs */
// Immutable append-only trail. Never updated or deleted by app code; old rows
// are moved to `archived = true` by the retention job.
await ensureTable("audit_logs", [
  pk(),
  col("actor_id", "string"),
  col("actor_role", "string"),        // customer | partner | rider | manager | support | admin | super_admin | system
  col("actor_name", "string"),
  col("action", "string"),            // login | restaurant.approve | wallet.adjust | menu.update …
  col("category", "string"),          // auth | user | restaurant | rider | manager | admin | support | wallet | coupon | reward | subscription | payment | kyc | settings | security
  col("subject_type", "string"),      // user | restaurant | driver | manager | order | coupon | ticket | wallet | setting …
  col("subject_id", "string"),
  col("summary", "string"),
  col("severity", "string"),          // info | notice | warning | critical
  col("meta", "json"),
  col("ip", "string"),
  col("user_agent", "string"),
  col("device_id", "string"),
  col("session_id", "string"),
  col("archived", "boolean", { defaultValue: "false" }),
  createdAt(),
]);

/* --------------------------------------------------------- login_history */
await ensureTable("login_history", [
  pk(),
  col("user_id", "string"),
  col("email", "string"),
  col("role", "string"),
  col("event", "string"),             // login | logout | failed | locked | password_reset | oauth
  col("provider", "string"),          // password | google | apple | phone
  col("success", "boolean"),
  col("reason", "string"),
  col("ip", "string"),
  col("city", "string"),
  col("country", "string"),
  col("device_id", "string"),
  col("device_label", "string"),
  col("browser", "string"),
  col("os", "string"),
  col("platform", "string"),
  col("user_agent", "string"),
  createdAt(),
]);

/* --------------------------------------------------------- user_sessions */
await ensureTable("user_sessions", [
  pk(),
  col("user_id", "string"),
  col("role", "string"),
  col("device_id", "string"),
  col("device_label", "string"),
  col("browser", "string"),
  col("os", "string"),
  col("platform", "string"),
  col("app", "string"),               // customer | partner | rider | manager | admin
  col("ip", "string"),
  col("user_agent", "string"),
  col("status", "string"),            // active | revoked | expired
  col("current", "boolean", { defaultValue: "false" }),
  col("last_seen_at", "datetime"),
  col("expires_at", "datetime"),
  col("revoked_at", "datetime"),
  col("revoked_by", "string"),
  col("revoke_reason", "string"),
  createdAt(),
]);

/* -------------------------------------------------------- security_events */
await ensureTable("security_events", [
  pk(),
  col("user_id", "string"),
  col("role", "string"),
  col("type", "string"),              // new_login | password_changed | email_changed | phone_changed | account_locked | account_unlocked | account_suspended | account_restored | deletion_requested | permission_changed | fraud_alert | session_revoked | data_exported | consent_updated | rate_limited
  col("severity", "string"),          // info | warning | critical
  col("title", "string"),
  col("detail", "string"),
  col("actor_id", "string"),
  col("actor_role", "string"),
  col("ip", "string"),
  col("device_id", "string"),
  col("meta", "json"),
  col("acknowledged", "boolean", { defaultValue: "false" }),
  col("acknowledged_by", "string"),
  col("acknowledged_at", "datetime"),
  createdAt(),
]);

/* ---------------------------------------------------------- fraud_reports */
await ensureTable("fraud_reports", [
  pk(),
  col("kind", "string"),              // multiple_accounts | referral_abuse | coupon_abuse | wallet_abuse | failed_logins | suspicious_device | impossible_location | fake_restaurant | fake_rider | order_cancellations | bulk_signup
  col("subject_type", "string"),      // user | restaurant | driver | device | ip
  col("subject_id", "string"),
  col("subject_label", "string"),
  col("risk_score", "integer"),       // 0-100
  col("severity", "string"),          // low | medium | high | critical
  col("signals", "json"),
  col("evidence", "json"),
  col("status", "string"),            // open | investigating | confirmed | dismissed
  col("resolution", "string"),
  col("resolved_by", "string"),
  col("resolved_at", "datetime"),
  col("fingerprint", "string"),       // dedupe key (kind + subject)
  col("detected_at", "datetime"),
  col("updated_at", "datetime"),
  createdAt(),
]);

/* ---------------------------------------------------- permission_overrides */
await ensureTable("permission_overrides", [
  pk(),
  col("user_id", "string"),
  col("role", "string"),
  col("permission", "string"),
  col("effect", "string"),            // grant | deny
  col("reason", "string"),
  col("granted_by", "string"),
  col("expires_at", "datetime"),
  col("active", "boolean", { defaultValue: "true" }),
  col("updated_at", "datetime"),
  createdAt(),
]);

/* -------------------------------------------------------- device_registry */
await ensureTable("device_registry", [
  pk(),
  col("device_id", "string"),
  col("user_id", "string"),
  col("label", "string"),
  col("browser", "string"),
  col("os", "string"),
  col("platform", "string"),
  col("app", "string"),
  col("trusted", "boolean", { defaultValue: "false" }),
  col("blocked", "boolean", { defaultValue: "false" }),
  col("account_count", "integer"),
  col("login_count", "integer"),
  col("last_ip", "string"),
  col("last_lat", "float"),
  col("last_lng", "float"),
  col("first_seen_at", "datetime"),
  col("last_seen_at", "datetime"),
  col("meta", "json"),
  createdAt(),
]);

/* -------------------------------------------------------- consent_records */
await ensureTable("consent_records", [
  pk(),
  col("user_id", "string"),
  col("kind", "string"),              // privacy_policy | terms | marketing_email | marketing_push | marketing_sms | data_processing | cookies
  col("version", "string"),
  col("granted", "boolean"),
  col("source", "string"),            // signup | settings | checkout
  col("ip", "string"),
  col("device_id", "string"),
  col("updated_at", "datetime"),
  createdAt(),
]);

/* ------------------------------ account-security columns on public.users */
await ensureTable("users", [
  col("permissions", "json"),
  col("account_state", "string"),       // active | locked | suspended | pending_deletion | deleted
  col("locked", "boolean", { defaultValue: "false" }),
  col("lock_reason", "string"),
  col("locked_at", "datetime"),
  col("locked_by", "string"),
  col("suspended_until", "datetime"),
  col("suspension_reason", "string"),
  col("failed_login_count", "integer"),
  col("last_failed_login_at", "datetime"),
  col("password_changed_at", "datetime"),
  col("deletion_requested_at", "datetime"),
  col("deletion_scheduled_for", "datetime"),
  col("deleted_at", "datetime"),
  col("last_ip", "string"),
  col("last_device_id", "string"),
  col("marketing_opt_in", "boolean"),
  col("privacy_version", "string"),
  col("terms_version", "string"),
  col("is_super_admin", "boolean"),
]);

/* --------------------------- support-agent flag on platform_admins */
await ensureTable("platform_admins", [
  col("level", "string"),               // support | admin | super_admin
  col("permissions", "json"),
  col("status", "string"),
  col("updated_at", "datetime"),
]);

console.log("security schema done");
