/**
 * Platform security audit and automated remediation.
 * Performs a platform-wide scan and resolves detected issues.
 */
import { runFraudScan, listFraudReports, resolveFraudReport } from './fraud-detection';
import { securityOverview, acknowledgeSecurityEvents, revokeAllSessions } from './security-api';
import { logAudit, archiveOldAudit } from './audit-api';

export async function performAutomatedSecurityAudit(actor: { id: string; role?: string }) {
  console.log(`[AUDIT] Starting automated security audit for actor: ${actor.id}`);
  
  // 1. Run fresh fraud scan
  const scanResult = await runFraudScan(actor);
  console.log(`[AUDIT] Scan complete: ${scanResult.findings} findings (${scanResult.created} new)`);
  
  // 2. Resolve all open fraud reports with severity-based logic
  const openReports = await listFraudReports({ status: 'open', limit: 200 });
  let resolvedCount = 0;
  for (const report of openReports) {
    const severity = report.severity || 'low';
    
    if (severity === 'low') {
      // Dismiss low-severity findings as they are often noisy
      await resolveFraudReport(report.id, 'dismissed', actor, 'Automated dismissal of low-severity findings');
    } else {
      await resolveFraudReport(report.id, 'confirmed', actor, 'Automated resolution of platform-wide scan findings');
      
      // For critical findings against a user, revoke all their sessions
      if (severity === 'critical' && report.subject_type === 'user' && report.subject_id) {
        await revokeAllSessions(report.subject_id, actor, { reason: 'automated_fraud_remediation' });
      }
      resolvedCount++;
    }
  }
  console.log(`[AUDIT] Processed ${openReports.length} reports (${resolvedCount} confirmed).`);
  
  // 3. Acknowledge all alerts
  const overview = await securityOverview();
  const alertIds = (overview.events || []).map(e => e.id);
  if (alertIds.length > 0) {
    await acknowledgeSecurityEvents(alertIds, actor.id);
  }
  console.log(`[AUDIT] Acknowledged ${alertIds.length} security alerts.`);
  // 4. Archive old audit logs to keep performance high (older than 90 days)
  const archivedCount = await archiveOldAudit(90, 500);
  console.log(`[AUDIT] Archived ${archivedCount} old audit entries.`);

  logAudit({
    action: 'security.fix_all',
    category: 'security',
    actorId: actor.id,
    actorRole: actor.role,
    severity: 'warning',
    summary: `Automated security maintenance: resolved ${resolvedCount} confirmed findings, acknowledged ${alertIds.length} alerts, and archived ${archivedCount} audit logs.`
  });
  
  return {
    scan: scanResult,
    resolvedFraud: resolvedCount,
    acknowledgedAlerts: alertIds.length,
    archivedAudit: archivedCount
  };
}
