-- Scoobix — recommended InsForge (Postgres) indexes
-- =================================================
-- Run once in the InsForge dashboard → SQL editor. The REST API has no index
-- endpoint, so this cannot be applied from app code.
--
-- Every index below backs a query the apps actually run. They are the single
-- cheapest way to keep ~10k customers / 500–1k DAU fast on a free-tier
-- database: without them PostgREST falls back to sequential scans on the
-- hot tables (orders, order_items, driver_tracking, ai_cache).

-- ── orders ────────────────────────────────────────────────────────────────
create index if not exists idx_orders_customer_created on public.orders (customer_id, created_at desc);
create index if not exists idx_orders_restaurant_created on public.orders (restaurant_id, created_at desc);
create index if not exists idx_orders_driver_created on public.orders (driver_id, created_at desc);
create index if not exists idx_orders_status_created on public.orders (status, created_at desc);

-- ── order items ───────────────────────────────────────────────────────────
create index if not exists idx_order_items_order on public.order_items (order_id);

-- ── live delivery ─────────────────────────────────────────────────────────
create index if not exists idx_driver_tracking_order_time on public.driver_tracking (order_id, created_at desc);
create index if not exists idx_drivers_status on public.drivers (status);

-- ── catalog ───────────────────────────────────────────────────────────────
create index if not exists idx_menu_items_restaurant on public.menu_items (restaurant_id);
create index if not exists idx_addons_menu_item on public.addons (menu_item_id);
create index if not exists idx_restaurants_live on public.restaurants (is_live, rating desc);

-- ── customer data ─────────────────────────────────────────────────────────
create index if not exists idx_addresses_user on public.addresses (user_id);
create index if not exists idx_favorites_user on public.favorites (user_id);
create index if not exists idx_reviews_restaurant on public.reviews (restaurant_id, created_at desc);
create index if not exists idx_notifications_user_time on public.notifications (user_id, created_at desc);
create index if not exists idx_wallet_tx_user_time on public.wallet_transactions (user_id, created_at desc);

-- ── campaigns ─────────────────────────────────────────────────────────────
create index if not exists idx_campaigns_active on public.campaigns (status, starts_at, ends_at);
create index if not exists idx_campaign_redemptions_user on public.campaign_redemptions (user_id, campaign_id);

-- ── CRM / onboarding ──────────────────────────────────────────────────────
create index if not exists idx_leads_manager_stage on public.restaurant_leads (manager_id, stage);
create index if not exists idx_lead_activities_lead on public.lead_activities (lead_id, created_at desc);
create index if not exists idx_support_messages_ticket on public.support_ticket_messages (ticket_id, created_at);
create index if not exists idx_support_tickets_status on public.support_tickets (status, created_at desc);

-- ── AI cost control ───────────────────────────────────────────────────────
-- The gateway looks up cache rows by key on every request; this index is what
-- makes the AI cache cheaper than the model call it replaces.
create unique index if not exists idx_ai_cache_key on public.ai_cache (cache_key);
create index if not exists idx_ai_cache_expiry on public.ai_cache (expires_at);
create index if not exists idx_ai_usage_provider_time on public.ai_usage_logs (provider, created_at desc);
create index if not exists idx_trending_searches_hits on public.trending_searches (hits desc);
create index if not exists idx_search_analytics_term on public.search_analytics (term, created_at desc);
create index if not exists idx_customer_preferences_user on public.customer_preferences (user_id);

-- ── housekeeping (keeps the free tier small) ──────────────────────────────
-- Run periodically, e.g. weekly:
--   delete from public.ai_cache where expires_at < now();
--   delete from public.ai_usage_logs where created_at < now() - interval '60 days';
--   delete from public.driver_tracking where created_at < now() - interval '14 days';
