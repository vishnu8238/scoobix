/**
 * Merchant Manager data layer — 100% InsForge, no mock data, no localStorage.
 *
 * Tables used:
 *  - merchant_managers   (manager accounts, targets, activation)
 *  - restaurants         (onboarding record + manager_id assignment)
 *  - onboarding_events   (status history / audit trail)
 *  - notifications       (admin decision alerts for the manager)
 *  - users               (auto-created restaurant owner account)
 */
import { useCallback, useEffect, useState } from "react";
import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";
import { INSFORGE_URL, INSFORGE_ANON_KEY, insforge } from "./insforge";
import { useAuth } from "./auth-store";
import { queueNotification } from "./notifications-queue";
export const ONBOARDING_STATUSES = [
    "draft",
    "document_pending",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "live",
];
export const ONBOARDING_LABEL = {
    draft: "Draft",
    document_pending: "Document pending",
    submitted: "Submitted",
    under_review: "Under review",
    approved: "Approved",
    rejected: "Rejected",
    live: "Live",
};
export const ONBOARDING_TONE = {
    draft: "bg-zinc-100 text-zinc-700",
    document_pending: "bg-amber-100 text-amber-700",
    submitted: "bg-sky-100 text-sky-700",
    under_review: "bg-violet-100 text-violet-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    live: "bg-primary-soft text-primary",
};
export function onboardingStatus(r) {
    const s = (r.onboarding_status ?? "draft");
    return ONBOARDING_STATUSES.includes(s) ? s : "draft";
}
// ---------- restaurant IDs (RST-10001, RST-10002, …) ----------
export const RST_PREFIX = "RST-";
const RST_START = 10001;
export function formatRstCode(n) {
    return `${RST_PREFIX}${Math.max(RST_START, Math.floor(n))}`;
}
export async function nextRstCode() {
    const rows = await listTable("restaurants", {
        select: "rst_code",
        limit: 2000,
    });
    const used = rows
        .map((r) => r.rst_code ?? "")
        .filter((c) => c.startsWith(RST_PREFIX))
        .map((c) => Number(c.slice(RST_PREFIX.length)))
        .filter((n) => Number.isFinite(n));
    return formatRstCode(used.length ? Math.max(...used) + 1 : RST_START);
}
// ---------- managers ----------
export async function listManagers() {
    return listTable("merchant_managers", { order: "created_at.desc", limit: 500 });
}
export async function getManagerByUser(userId) {
    if (!userId)
        return null;
    const rows = await listTable("merchant_managers", {
        user_id: `eq.${userId}`,
        limit: 1,
    });
    return rows[0] ?? null;
}
export async function updateManager(id, patch) {
    await patchRecord("merchant_managers", id, {
        ...patch,
        updated_at: new Date().toISOString(),
    });
}
/** Random, human-typeable temporary password for provisioned accounts. */
export function tempPassword() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    bytes.forEach((b) => (out += alphabet[b % alphabet.length]));
    return `Sx-${out}`;
}
/**
 * Creates an InsForge auth account WITHOUT touching the caller's session, then
 * writes the matching `public.users` profile row with the requested role.
 * Used to provision merchant managers and restaurant owner accounts.
 */
export async function provisionAccount(input) {
    const password = input.password ?? tempPassword();
    const email = input.email.trim().toLowerCase();
    if (!email)
        return { ok: false, password, message: "Email is required" };
    // Existing account? Reuse it instead of failing the whole flow.
    const existing = await listTable("users", {
        email: `eq.${email}`,
        select: "id",
        limit: 1,
    });
    if (existing[0]?.id) {
        console.info(`[PROVISION_ACCOUNT] Reusing existing user account for ${email}: ${existing[0].id}`);
        await patchRecord("users", existing[0].id, {
            role: input.role,
            name: input.name || undefined,
            phone: input.phone || undefined,
        });
        return { ok: true, userId: existing[0].id, password, message: "Existing account reused" };
    }
    let userId;
    try {
        const res = await fetch(`${INSFORGE_URL}/api/auth/users?client_type=mobile`, {
            method: "POST",
            headers: {
                apikey: INSFORGE_ANON_KEY,
                Authorization: `Bearer ${INSFORGE_ANON_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password, name: input.name }),
        });
        const body = await res.json().catch(() => null);
        const payload = body?.data ?? body;
        if (!res.ok) {
            return { ok: false, password, message: payload?.message || payload?.error || "Could not create account" };
        }
        userId = payload?.user?.id ?? payload?.id;
    }
    catch (err) {
        return { ok: false, password, message: err instanceof Error ? err.message : "Network error" };
    }
    if (!userId)
        return { ok: false, password, message: "Account created without an id" };
    await createRecord("users", {
        id: userId,
        email,
        name: input.name,
        phone: input.phone ?? null,
        role: input.role,
        status: "active",
        wallet_balance: 0,
        loyalty_points: 0,
        provider: "email",
        providers: "email",
        email_verified: false,
        created_at: new Date().toISOString(),
    });
    return { ok: true, userId, password };
}
/** Admin: create a merchant manager (auth account + manager record). */
export async function createManagerAccount(input) {
    const account = await provisionAccount({
        email: input.email,
        name: input.name,
        phone: input.phone,
        role: "MERCHANT_MANAGER",
    });
    if (!account.ok || !account.userId)
        return { ok: false, message: account.message };
    const existing = await getManagerByUser(account.userId);
    if (existing) {
        await updateManager(existing.id, {
            name: input.name,
            email: input.email,
            phone: input.phone ?? null,
            region: input.region ?? null,
            monthly_target: input.monthlyTarget ?? 10,
            status: "active",
        });
        return { ok: true, password: account.password, message: "Existing account reused" };
    }
    const created = await createRecord("merchant_managers", {
        user_id: account.userId,
        name: input.name,
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? null,
        region: input.region ?? null,
        status: "active",
        monthly_target: input.monthlyTarget ?? 10,
        created_by: input.createdBy ?? null,
    });
    if (!created)
        return { ok: false, message: "Manager record could not be saved" };
    return { ok: true, password: account.password };
}
// ---------- assigned restaurants ----------
export async function listManagerRestaurants(managerId) {
    if (!managerId)
        return [];
    return listTable("restaurants", {
        manager_id: `eq.${managerId}`,
        order: "created_at.desc",
        limit: 500,
    });
}
export async function listUnassignedRestaurants() {
    return listTable("restaurants", {
        manager_id: "is.null",
        order: "created_at.desc",
        limit: 500,
    });
}
export async function assignRestaurant(restaurantId, managerId) {
    await patchRecord("restaurants", restaurantId, { manager_id: managerId });
}
export async function deleteManagedRestaurant(id) {
    try {
        // Audit log before deletion
        await createRecord("onboarding_events", {
            restaurant_id: id,
            status: "deleted",
            note: "Restaurant record deleted by manager",
            actor_role: "manager",
        });
        await deleteRecord("restaurants", id);
        return true;
    }
    catch (err) {
        console.error("Delete failed:", err);
        return false;
    }
}
export async function saveOnboardingDraft(id, values) {
    // UUID validation: ensure we never use "pending-refresh" or invalid sentinels
    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    const safeId = id && isUuid(id) ? id : null;
    try {
        if (safeId) {
            console.info(`[MANAGER_API] Updating existing restaurant draft: ${safeId}`);
            await patchRecord("restaurants", safeId, values);
            const rows = await listTable("restaurants", { id: `eq.${safeId}`, limit: 1 }, { fresh: true });
            return rows[0] ?? null;
        }
        console.info(`[MANAGER_API] Creating new restaurant draft`);
        const created = await createRecord("restaurants", values);
        // Authoritative UUID resolution from createRecord response
        if (created && isUuid(created.id)) {
            console.info(`[MANAGER_API] Created record with ID: ${created.id}`);
            return created;
        }
        // Fallback: If creation response is ambiguous, look for the most recent record for this manager
        const managerId = values.manager_id;
        if (managerId) {
            console.warn(`[MANAGER_API] createRecord returned ambiguous ID, checking manager history...`);
            const latest = await listTable("restaurants", {
                manager_id: `eq.${managerId}`,
                order: "created_at.desc",
                limit: 1,
            }, { fresh: true });
            if (latest[0] && isUuid(latest[0].id)) {
                return latest[0];
            }
        }
        return null;
    }
    catch (err) {
        console.error(`[MANAGER_API] saveOnboardingDraft failed:`, err);
        throw err;
    }
}
export async function logOnboardingEvent(input) {
    await createRecord("onboarding_events", {
        restaurant_id: input.restaurantId,
        manager_id: input.managerId ?? null,
        status: input.status,
        note: input.note ?? null,
        actor_role: input.actorRole ?? "manager",
    });
}
export async function listOnboardingHistory(restaurantId, managerId) {
    const params = { order: "created_at.desc", limit: 300 };
    if (restaurantId)
        params.restaurant_id = `eq.${restaurantId}`;
    if (managerId)
        params.manager_id = `eq.${managerId}`;
    return listTable("onboarding_events", params);
}
/** Notify a manager that admin approved / rejected one of their restaurants. */
export async function notifyManagerDecision(input) {
    const managerId = input.restaurant.manager_id;
    if (!managerId)
        return;
    const managers = await listTable("merchant_managers", {
        id: `eq.${managerId}`,
        limit: 1,
    });
    const userId = managers[0]?.user_id;
    await logOnboardingEvent({
        restaurantId: input.restaurant.id,
        managerId,
        status: input.decision,
        note: input.note,
        actorRole: "admin",
    });
    if (!userId)
        return;
    // Queued + de-duplicated: bursts of decisions collapse into one insert.
    queueNotification({
        user_id: userId,
        title: `Restaurant ${input.decision}`,
        message: `${input.restaurant.name ?? "Restaurant"} (${input.restaurant.rst_code ?? ""}) was ${input.decision} by admin.${input.note ? ` ${input.note}` : ""}`,
        kind: "system",
        dedupeKey: `decision:${input.restaurant.id}:${input.decision}`,
    });
}
// ---------- hooks ----------
/** Resolves the signed-in merchant manager record. */
export function useManager() {
    const { user } = useAuth();
    const [manager, setManager] = useState(null);
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => {
        // Authoritative check from session first to avoid stale hook states
        const session = insforge.auth.session;
        const authId = session?.user?.id || user?.id;
        if (!authId) {
            console.warn("[MANAGER_API] No auth ID found for manager resolution.");
            setManager(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            let row = await getManagerByUser(authId);
            // Self-heal: an auth account with the manager role but no manager record.
            const isManagerRole = user?.role === "manager" || user?.roles?.includes("manager");
            if (!row && isManagerRole) {
                console.info(`[MANAGER_API] Self-healing manager record for user ${authId}`);
                const created = await createRecord("merchant_managers", {
                    user_id: authId,
                    name: user?.name || session?.user?.name || "Manager",
                    email: user?.email || session?.user?.email,
                    phone: user?.phone || null,
                    status: "active",
                    monthly_target: 10,
                });
                row = (Array.isArray(created) ? created[0] : created);
            }
            setManager(row ?? null);
        }
        catch (err) {
            console.error("[MANAGER_API] Failed to resolve manager:", err);
            setManager(null);
        }
        finally {
            setLoading(false);
        }
    }, [user?.id, user?.role, user?.roles, user?.name, user?.email, user?.phone]);
    useEffect(() => { void refresh(); }, [refresh]);
    return { manager, loading, refresh };
}
export function useManagerRestaurants(managerId) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async () => {
        if (!managerId) {
            setList([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setList(await listManagerRestaurants(managerId));
        setLoading(false);
    }, [managerId]);
    useEffect(() => { void refresh(); }, [refresh]);
    return { list, loading, refresh };
}
export function managerStats(list, target) {
    const by = (s) => list.filter((r) => onboardingStatus(r) === s).length;
    const live = list.filter((r) => onboardingStatus(r) === "live" || r.status === "approved").length;
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const thisMonth = list.filter((r) => r.created_at && Date.parse(r.created_at) >= monthStart.getTime()).length;
    return {
        onboarded: list.length,
        drafts: by("draft") + by("document_pending"),
        pending: by("submitted") + by("under_review"),
        live,
        rejected: by("rejected"),
        thisMonth,
        target,
        progress: target > 0 ? Math.min(100, Math.round((thisMonth / target) * 100)) : 0,
    };
}
