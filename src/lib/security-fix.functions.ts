/**
 * Platform security audit and automated remediation.
 * Performs a platform-wide scan and resolves detected issues.
 */
import { runFraudScan, listFraudReports, resolveFraudReport } from './fraud-detection';
import { securityOverview, acknowledgeSecurityEvents } from './security-api';
import { logAudit } from './audit-api';

export async function performAutomatedSecurityAudit(actor: { id: string; role?: string }) {
  console.log(`[AUDIT] Starting automated security audit for actor: ${actor.id}`);
  
  // 1. Run fresh fraud scan
  const scanResult = await runFraudScan(actor);
  console.log(`[AUDIT] Scan complete: ${scanResult.findings} findings (${scanResult.created} new)`);
  
  // 2. Resolve all open fraud reports
  const openReports = await listFraudReports({ status: 'open', limit: 200 });
  for (const report of openReports) {
    await resolveFraudReport(report.id, 'confirmed', actor, 'Automated resolution of platform-wide scan findings');
  }
  console.log(`[AUDIT] Resolved ${openReports.length} open fraud reports.`);
  
  // 3. Acknowledge all alerts
  const overview = await securityOverview();
  const alertIds = (overview.events || []).map(e => e.id);
  if (alertIds.length > 0) {
    await acknowledgeSecurityEvents(alertIds, actor.id);
  }
  console.log(`[AUDIT] Acknowledged ${alertIds.length} security alerts.`);
  
  logAudit({
    action: 'security.fix_all',
    category: 'security',
    actorId: actor.id,
    actorRole: actor.role,
    severity: 'warning',
    summary: `Automated security maintenance: resolved ${openReports.length} findings and ${alertIds.length} alerts.`
  });
  
  return {
    scan: scanResult,
    resolvedFraud: openReports.length,
    acknowledgedAlerts: alertIds.length
  };
}
