/**
 * Scoobix AI usage policy — cost control for the startup stage.
 *
 * AI is expensive; the platform must serve ~10k customers on near-zero infra.
 * So AI is *opt-in per capability*, never ambient:
 *
 *  ALLOWED  → natural-language food search, meal planner, recommendations,
 *             support assistant, marketing content, restaurant insights.
 *  BLOCKED  → homepage rails, restaurant listing/details, menu browsing,
 *             cart, checkout, order/rider tracking, CMS pages, profile,
 *             settings. Those surfaces use rule-based logic + DB queries.
 *
 * Everything else is handled by aggressive caching (see `MIN_TTL`) so a
 * repeated request never reaches a provider again.
 */
import { AI_TASKS, type AiTask } from "./tasks";

/** Surfaces that must never trigger a model call. */
export const AI_BLOCKED_SURFACES = [
  "home",
  "restaurant_list",
  "restaurant_details",
  "menu",
  "cart",
  "checkout",
  "order_tracking",
  "rider_tracking",
  "cms",
  "profile",
  "settings",
] as const;

/**
 * Tasks that may reach a provider. Anything not listed is served from cache
 * or degraded to rule-based logic without a model call.
 */
export const AI_ALLOWED_TASKS = new Set<string>([
  // natural language food search
  "search_intent",
  // meal planner
  "meal_plan",
  "diet_plan",
  "nutrition_estimate",
  // recommendations (generated once, reused — see MIN_TTL)
  "recommend_sections",
  // support assistant
  "food_assistant",
  "support_reply",
  "support_summary",
  "ticket_triage",
  "faq_answer",
  // marketing content
  "menu_copy",
  "seo_meta",
  "dish_tags",
  "translate_menu",
  "campaign_desc",
  "promo_text",
  "email_draft",
  "festival_ideas",
  "social_caption",
  "blog_ideas",
  "landing_copy",
  // restaurant / business insights (admin, partner, manager, rider consoles)
  "sales_insights",
  "performance_summary",
  "pricing_suggest",
  "bestseller_predict",
  "inventory_suggest",
  "menu_audit",
  "platform_insights",
  "growth_insights",
  "anomaly_detect",
  "lead_score",
  "lead_prioritize",
  "potential_score",
  "followup_suggest",
  "visit_summary",
  "earnings_predict",
  "peak_hours",
  "acceptance_insights",
  "cod_summary",
  "route_optimize",
]);

/** Cheap tasks explicitly excluded even though they exist in the registry. */
export const AI_DISABLED_TASKS = new Set<string>(["upsell"]);

export function aiTaskAllowed(task: string): boolean {
  if (AI_DISABLED_TASKS.has(task)) return false;
  if (AI_ALLOWED_TASKS.has(task)) return true;
  // Unknown/registry-only tasks default to allowed ONLY if they are cacheable
  // insight-style tasks; interactive per-view tasks stay off.
  const def = (AI_TASKS as Record<string, { ttl?: number }>)[task];
  return Boolean(def && (def.ttl ?? 0) >= 900);
}

/**
 * Cache TTL floor (seconds) per task family. Applied on top of the registry
 * TTL so repeated requests are answered from cache instead of a provider.
 */
export const MIN_TTL: Record<string, number> = {
  search_intent: 86_400, // same query → same intent, effectively static
  recommend_sections: 21_600, // 6h — regenerated only when behaviour changes
  meal_plan: 43_200,
  diet_plan: 43_200,
  nutrition_estimate: 604_800,
  food_assistant: 900,
  support_reply: 3_600,
  faq_answer: 604_800,
  menu_copy: 604_800,
  seo_meta: 604_800,
  dish_tags: 604_800,
  translate_menu: 604_800,
  campaign_desc: 86_400,
  promo_text: 86_400,
  email_draft: 86_400,
  social_caption: 86_400,
  festival_ideas: 604_800,
  blog_ideas: 604_800,
  landing_copy: 604_800,
  sales_insights: 21_600,
  performance_summary: 21_600,
  platform_insights: 21_600,
  growth_insights: 21_600,
  pricing_suggest: 43_200,
  bestseller_predict: 43_200,
  inventory_suggest: 21_600,
  menu_audit: 43_200,
  lead_score: 21_600,
  lead_prioritize: 10_800,
  potential_score: 21_600,
  followup_suggest: 10_800,
  earnings_predict: 10_800,
  peak_hours: 86_400,
  acceptance_insights: 21_600,
  route_optimize: 3_600,
};

/** Effective TTL for a task: max(registry ttl, policy floor). */
export function effectiveTtl(task: string, registryTtl = 0): number {
  return Math.max(registryTtl, MIN_TTL[task] ?? 0);
}

/* ──────────────── heuristics that keep AI off the hot path ──────────────── */

const INTENT_WORDS = /\b(under|below|cheap|budget|healthy|protein|spicy|veg|vegan|jain|light|craving|for (two|three|dinner|lunch|breakfast|party)|something|best|late night|diet|calorie|combo|family|office)\b/i;

/**
 * True only for genuinely natural-language queries. Plain keyword searches
 * ("pizza", "biryani") are served by the local rule-based filter for free.
 */
export function isNaturalLanguageQuery(query: string): boolean {
  const q = query.trim();
  if (q.length < 8) return false;
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length < 3) return false;
  return INTENT_WORDS.test(q) || words.length >= 4;
}

/**
 * Compact signature of a customer's behaviour. Recommendations are reused
 * until this changes — not regenerated on every screen visit.
 */
export function behaviourSignature(input: {
  userId?: string;
  orderCount?: number;
  lastOrderId?: string;
  favouritesCount?: number;
  vegMode?: boolean;
}): string {
  const slot = Math.floor(new Date().getHours() / 6); // morning/afternoon/evening/night
  const day = new Date().getDay() >= 5 ? "we" : "wd";
  return [
    input.userId ?? "anon",
    input.orderCount ?? 0,
    input.lastOrderId ?? "-",
    input.favouritesCount ?? 0,
    input.vegMode ? "veg" : "all",
    slot,
    day,
  ].join("|");
}

export type { AiTask };
