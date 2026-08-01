/**
 * One-off schema migration for the Scoobix Subscription & Membership engine.
 * Run with: INSFORGE_API_KEY=... node scripts/subscriptions-schema.mjs
 */
const URL_BASE = "https://awvs3seh.us-east.insforge.app";
const KEY = process.env.INSFORGE_API_KEY;
if (!KEY) throw new Error("INSFORGE_API_KEY missing");

const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const col = (columnName, type, extra = {}) => ({
  columnName, type, isNullable: true, isUnique: false, ...extra,
});

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

// ---------------------------------------------------------------- plans
await ensureTable("subscription_plans", [
  col("code", "string"),
  col("audience", "string"),            // customer | restaurant | manager | rider
  col("tier", "string"),                // free | plus | starter | growth | pro | enterprise
  col("billing_period", "string"),      // none | monthly | quarterly | yearly | custom
  col("price", "float"),
  col("compare_price", "float"),
  col("trial_days", "integer"),
  col("status", "string"),              // draft | active | paused | scheduled | archived
  col("promotional", "boolean"),
  col("sort_order", "integer"),
  col("starts_at", "datetime"),
  col("ends_at", "datetime"),
  col("benefits", "json"),              // membership benefit map
  col("limits", "json"),                // quota map (menu size, branches, offers…)
  col("commission_percent", "float"),
  col("cloned_from", "string"),
  col("created_by", "string"),
  col("updated_at", "datetime"),
]);

// ------------------------------------------------------- subscriptions
await ensureTable("subscriptions", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("subject_type", "string"),        // customer | restaurant | manager | rider
  col("subject_id", "string"),
  col("plan_id", "string"),
  col("plan_code", "string"),
  col("status", "string"),              // trialing | active | past_due | cancelled | expired | paused
  col("price", "float"),
  col("billing_period", "string"),
  col("auto_renew", "boolean", { defaultValue: "true" }),
  col("started_at", "datetime"),
  col("period_start", "datetime"),
  col("period_end", "datetime"),
  col("renewal_date", "datetime"),
  col("trial_end", "datetime"),
  col("cancelled_at", "datetime"),
  col("cancel_reason", "string"),
  col("source", "string"),              // self | admin | promo | trial
  col("assigned_by", "string"),
  col("savings_total", "float"),
  col("metadata", "json"),
  col("created_at", "datetime", { defaultValue: "now()" }),
  col("updated_at", "datetime"),
]);

await ensureTable("subscription_history", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("subscription_id", "string"),
  col("subject_type", "string"),
  col("subject_id", "string"),
  col("action", "string"),              // created | renewed | upgraded | downgraded | cancelled | paused | resumed | expired | assigned | trial_started
  col("from_plan", "string"),
  col("to_plan", "string"),
  col("amount", "float"),
  col("actor_id", "string"),
  col("actor_role", "string"),
  col("note", "string"),
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

await ensureTable("subscription_invoices", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("invoice_no", "string"),
  col("subscription_id", "string"),
  col("subject_type", "string"),
  col("subject_id", "string"),
  col("plan_id", "string"),
  col("plan_name", "string"),
  col("amount", "float"),
  col("tax", "float"),
  col("total", "float"),
  col("currency", "string"),
  col("status", "string"),              // paid | due | failed | refunded
  col("period_start", "datetime"),
  col("period_end", "datetime"),
  col("paid_at", "datetime"),
  col("payment_method", "string"),
  col("payment_id", "string"),
  col("checksum", "string"),            // tamper detection
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

await ensureTable("subscription_usage", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("subscription_id", "string"),
  col("subject_type", "string"),
  col("subject_id", "string"),
  col("metric", "string"),              // free_delivery | offers_created | branches | menu_items | cancellations…
  col("period", "string"),              // YYYY-MM
  col("used", "float"),
  col("quota", "float"),
  col("value_saved", "float"),
  col("updated_at", "datetime"),
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

await ensureTable("membership_benefits", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("plan_id", "string"),
  col("key", "string"),
  col("label", "string"),
  col("description", "string"),
  col("value", "float"),
  col("unit", "string"),
  col("enabled", "boolean", { defaultValue: "true" }),
  col("sort_order", "integer"),
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

await ensureTable("rider_incentives", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("driver_id", "string"),
  col("plan_id", "string"),
  col("type", "string"),                // peak_hour | daily_target | weekly | monthly | referral | rain | festival | guaranteed
  col("period", "string"),
  col("period_start", "datetime"),
  col("period_end", "datetime"),
  col("target", "float"),
  col("achieved", "float"),
  col("amount", "float"),
  col("status", "string"),              // pending | approved | paid | rejected
  col("orders_completed", "integer"),
  col("acceptance_rate", "float"),
  col("completion_rate", "float"),
  col("online_hours", "float"),
  col("notes", "string"),
  col("paid_at", "datetime"),
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

await ensureTable("merchant_targets", [
  col("id", "uuid", { isNullable: false, isPrimaryKey: true, isUnique: true, defaultValue: "gen_random_uuid()" }),
  col("manager_id", "string"),
  col("plan_id", "string"),
  col("period", "string"),              // YYYY-MM
  col("region", "string"),
  col("target", "float"),
  col("achieved", "float"),
  col("assigned_restaurants", "integer"),
  col("live_restaurants", "integer"),
  col("commission", "float"),
  col("bonus", "float"),
  col("growth_percent", "float"),
  col("status", "string"),
  col("notes", "string"),
  col("created_at", "datetime", { defaultValue: "now()" }),
]);

console.log("done");
