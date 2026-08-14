# Security Remediation Plan

The project requires resolving platform-wide security issues identified through automated scanning and manual inspection. We will implement a systematic fix for fraud reports, security alerts, and audit trail maintenance.

## Proposed Changes

### 1. Fix Automated Security Audit Handler
- The `performAutomatedSecurityAudit` function in `src/lib/security-fix.functions.ts` currently confirmation-resolves all fraud reports as "confirmed".
- **Refinement**: Update the automated scan to handle different fraud severities appropriately (e.g., dismiss "low" risks that are false positives based on newer heuristics).

### 2. UI/UX Improvements for Security Console
- Enhance `src/routes/admin.security.tsx` to display detailed evidence for fraud findings within the resolution modal.
- Add a "Fix All" button to the Security Console that invokes the server function `fixSecurityIssues`.

### 3. Implement Targeted Remediation Actions
- Update `src/lib/security-api.ts` to include specific remediation helpers (e.g., batch-revoking sessions for suspicious accounts).
- Integrate these helpers into the `performAutomatedSecurityAudit` flow.

### 4. Audit Retention and Maintenance
- Automate the calling of `archiveOldAudit` within the security maintenance routine to ensure the live audit table remains performant.

## Technical Details

- **File**: `src/lib/security-fix.functions.ts`
  - Refine the loop that resolves fraud reports.
  - Add logic to batch-revoke sessions for "critical" severity findings.
- **File**: `src/routes/admin.security.tsx`
  - Add UI controls for the new automated maintenance functions.
  - Implement evidence visualization.
- **File**: `src/lib/security-api.ts`
  - Export additional administrative actions.

## Verification Plan

- Run the "Run fraud scan" and the new "Fix All" actions from the Admin Security console.
- Verify that security alerts are acknowledged and fraud reports are resolved in the database.
- Check the `audit_logs` to ensure all remediation actions are correctly tracked with appropriate severity.
