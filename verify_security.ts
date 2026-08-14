import { performAutomatedSecurityAudit } from "./lib/security-fix.functions";

async function verify() {
  console.log("Starting security scan verification...");
  try {
    const result = await performAutomatedSecurityAudit({ id: "system_verify", role: "super_admin" });
    console.log("Security scan result:", JSON.stringify(result, null, 2));
    if (result.scan.findings === 0) {
      console.log("PASS: No critical findings remaining.");
    } else {
      console.log(`WARNING: ${result.scan.findings} findings remain. Check logs.`);
    }
  } catch (err) {
    console.error("Security scan failed:", err);
    process.exit(1);
  }
}

verify();
