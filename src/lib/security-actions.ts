import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { performAutomatedSecurityAudit } from "./security-fix.functions";

export const fixSecurityIssues = createServerFn({ method: "POST" })
  .inputValidator((data: any) => {
    // TanStack Start v1 input validator sometimes receives the data 
    // wrapped or directly. We ensure we get the object for Zod.
    const input = data?.data ?? data;
    return z.object({ 
      actorId: z.string(),
      actorRole: z.string().optional()
    }).parse(input);
  })
  .handler(async ({ data }) => {
    return performAutomatedSecurityAudit({
      id: data.actorId,
      role: data.actorRole
    });
  });
