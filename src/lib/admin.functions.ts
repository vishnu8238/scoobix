import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ADMIN_EMAIL = "scoobix.info@gmail.com";

export const checkAdminEmail = createServerFn({ method: "GET" })
  .inputValidator((email: unknown) => z.string().email().parse(email))
  .handler(async ({ data: email }) => {
    // SECURITY: This is the source of truth for admin email authorization.
    // It runs on the server and cannot be bypassed by client-side state manipulation.
    if (email !== ADMIN_EMAIL) {
      return { authorized: false, error: "This Google account is not authorized for Scoobix Admin." };
    }
    return { authorized: true };
  });
