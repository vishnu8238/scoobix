import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { checkPortalAccess } from "./portal-authorization";

export const checkAdminEmail = createServerFn({ method: "GET" })
  .inputValidator((email: unknown) => z.string().email().parse(email))
  .handler(async ({ data: email }) => {
    // AUTHORITATIVE: Use the portal_access mechanism for Admin authorization.
    // This replaces the historical hardcoded email comparison.
    const result = await checkPortalAccess(email, "admin");
    
    if (!result.ok) {
      const message = result.reason === "disabled" 
        ? "This account has been disabled."
        : "This Google account is not authorized for Scoobix Admin.";
      return { authorized: false, error: message };
    }
    
    return { authorized: true };
  });
