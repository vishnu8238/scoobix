// Federated identity linking.
//
// SECURITY MODEL
// --------------
// An authenticated provider identity (InsForge Auth UUID) is NEVER granted the
// memberships of another identity just because the email strings match.
// Cross-identity authorization is only possible through an explicit, audited
// row in `auth_identity_links`, created by a privileged (server/admin) linking
// workflow that proved ownership of BOTH identities.
//
//   auth_identity_links
//     id                uuid  (pk)
//     canonical_user_id uuid  -> the ONE canonical application identity
//     provider          text  ('email' | 'google' | 'apple' | 'phone' | 'legacy')
//     provider_subject  text  UNIQUE -> the provider/auth identity being linked
//     provider_email    text  (signal only, never an authorization key)
//     linked_at, linked_by, created_at, updated_at
//
// The table is RLS-protected: readable by the app, writable only with a
// privileged key. Client code can therefore resolve links but can never mint
// one, so a link can never be forged to escalate privileges.

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";
import { getAccessToken } from "./insforge-auth";

export type IdentityProvider = "email" | "google" | "apple" | "phone" | "legacy";

export type IdentityLinkRow = {
  id: string;
  canonical_user_id: string;
  provider: string;
  provider_subject: string;
  provider_email: string | null;
  linked_at: string | null;
  linked_by: string | null;
};

function authHeaders(token?: string) {
  // The link table is RLS-protected: reads require the caller's own session
  // token, so a signed-out client can never enumerate identity links.
  const bearer = token || getAccessToken() || INSFORGE_ANON_KEY;
  return {
    apikey: INSFORGE_ANON_KEY,
    Authorization: `Bearer ${bearer}`,
    "Content-Type": "application/json",
  };
}

/**
 * Resolve the authenticated Auth UUID to its canonical application identity.
 *
 * Resolution order:
 *   1. An explicit `auth_identity_links` row for this exact provider subject.
 *   2. Otherwise the Auth UUID itself (it IS its own canonical identity).
 *
 * There is deliberately no email-based fallback: same email !== same
 * authorization identity.
 */
export async function resolveCanonicalUserId(
  authUserId: string,
  token?: string
): Promise<{ canonicalUserId: string; linked: boolean; link: IdentityLinkRow | null }> {
  if (!authUserId) return { canonicalUserId: authUserId, linked: false, link: null };

  try {
    const url =
      `${INSFORGE_URL}/api/database/records/auth_identity_links` +
      `?provider_subject=eq.${encodeURIComponent(authUserId)}&limit=1`;
    const res = await fetch(url, { headers: authHeaders(token) });
    if (res.ok) {
      const rows = (await res.json()) as IdentityLinkRow[];
      const link = Array.isArray(rows) ? rows[0] : undefined;
      if (link?.canonical_user_id) {
        return { canonicalUserId: link.canonical_user_id, linked: true, link };
      }
    }
  } catch {
    // A link lookup failure must never silently grant or revoke access:
    // fall back to the identity's own UUID (least privilege).
  }

  return { canonicalUserId: authUserId, linked: false, link: null };
}

/**
 * Create an explicit identity link. Requires a privileged token — the RLS
 * policy rejects anon/authenticated writes, so an ordinary signed-in user
 * cannot link themselves into somebody else's canonical identity.
 *
 * Ownership of BOTH identities must be proven before calling this:
 *   - the caller is authenticated as `canonicalUserId`, and
 *   - the caller has just completed a fresh provider authentication that
 *     returned `providerSubject`.
 */
export async function createIdentityLink(input: {
  canonicalUserId: string;
  provider: IdentityProvider;
  providerSubject: string;
  providerEmail?: string | null;
  linkedBy: string;
  privilegedToken: string;
}): Promise<{ ok: boolean; message?: string }> {
  if (!input.privilegedToken) {
    return { ok: false, message: "Identity linking requires a privileged token." };
  }
  if (input.canonicalUserId === input.providerSubject) {
    return { ok: false, message: "Identity is already its own canonical identity." };
  }
  try {
    const res = await fetch(`${INSFORGE_URL}/api/database/records/auth_identity_links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.privilegedToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          canonical_user_id: input.canonicalUserId,
          provider: input.provider,
          provider_subject: input.providerSubject,
          provider_email: input.providerEmail ?? null,
          linked_by: input.linkedBy,
        },
      ]),
    });
    if (!res.ok) return { ok: false, message: `Link rejected (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Link failed" };
  }
}
