/**
 * Phone OTP integration layer.
 *
 * InsForge Auth currently exposes email/password, OAuth and email OTP —
 * there is no phone (SMS) OTP endpoint. Rather than fake it, this module is a
 * provider-agnostic seam: point `PHONE_OTP_PROVIDER` at an implementation and
 * phone login lights up in the existing login screen with no UI changes.
 *
 * Configure with `VITE_PHONE_OTP_PROVIDER`:
 *   "none"     (default) — phone login is hidden everywhere.
 *   "insforge" — uses InsForge phone endpoints once the backend ships them.
 *   "custom"   — posts to `VITE_PHONE_OTP_ENDPOINT` (your own SMS gateway).
 */

import { INSFORGE_URL, INSFORGE_ANON_KEY } from "./insforge";

export type PhoneOtpProviderId = "none" | "insforge" | "custom";

const PROVIDER = ((import.meta.env.VITE_PHONE_OTP_PROVIDER as string) || "none") as PhoneOtpProviderId;
const CUSTOM_ENDPOINT = (import.meta.env.VITE_PHONE_OTP_ENDPOINT as string) || "";

/** OTP resend cooldown in seconds — used by the countdown timer in the UI. */
export const OTP_RESEND_SECONDS = 30;
/** Digits in a verification code (drives auto-verify). */
export const OTP_LENGTH = 6;

export function isPhoneOtpEnabled(): boolean {
  if (PROVIDER === "none") return false;
  if (PROVIDER === "custom") return !!CUSTOM_ENDPOINT;
  return true;
}

export function phoneOtpProvider(): PhoneOtpProviderId {
  return PROVIDER;
}

export type OtpSendResult = { ok: boolean; message?: string; resendAfter: number };
export type OtpVerifyResult = {
  ok: boolean;
  message?: string;
  /** Session tokens issued by the provider when verification succeeds. */
  accessToken?: string;
  refreshToken?: string | null;
  userId?: string;
  isNewUser?: boolean;
};

function baseFor(path: string): string {
  if (PROVIDER === "custom") return `${CUSTOM_ENDPOINT.replace(/\/$/, "")}${path}`;
  return `${INSFORGE_URL}/api/auth/phone${path}`;
}

async function call(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(baseFor(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: INSFORGE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  return data;
}

/** Normalise to E.164-ish so the same number never creates two accounts. */
export function normalisePhone(raw: string, defaultCountry = "+91"): string {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return `${defaultCountry}${digits.replace(/^0+/, "")}`;
}

export async function sendPhoneOtp(phone: string): Promise<OtpSendResult> {
  if (!isPhoneOtpEnabled()) {
    return { ok: false, message: "Phone sign-in is not enabled for this project.", resendAfter: 0 };
  }
  try {
    await call("/send-otp", { phone: normalisePhone(phone) });
    return { ok: true, resendAfter: OTP_RESEND_SECONDS };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not send OTP", resendAfter: 0 };
  }
}

export async function verifyPhoneOtp(phone: string, otp: string): Promise<OtpVerifyResult> {
  if (!isPhoneOtpEnabled()) {
    return { ok: false, message: "Phone sign-in is not enabled for this project." };
  }
  try {
    const data = await call("/verify-otp", { phone: normalisePhone(phone), otp, client_type: "mobile" });
    return {
      ok: true,
      accessToken: data?.accessToken,
      refreshToken: data?.refreshToken ?? null,
      userId: data?.user?.id,
      isNewUser: !!data?.isNewUser,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Invalid or expired code" };
  }
}
