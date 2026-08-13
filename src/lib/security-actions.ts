import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { performAutomatedSecurityAudit } from "./security-fix.functions";

export const fixSecurityIssues = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ 
    actorId: z.string(),
    actorRole: z.string().optional()
  }).parse(data))
  .handler(async ({ data }) => {
    return performAutomatedSecurityAudit({
      id: data.actorId,
      role: data.actorRole
    });
  });
