# Security Remediation Plan - Phase 2

We are implementing targeted security fixes based on the latest scan results, focusing on automated remediation logic, UI transparency in the security console, and audit trail maintenance.

## Proposed Changes

### 1. Refine Automated Remediation Logic
- **File**: `src/lib/security-fix.functions.ts`
- **Logic**:
    - Update `performAutomatedSecurityAudit` to handle "critical" fraud findings with immediate session revocation and account locking.
    - Implement a "graceful dismissal" for "low" severity findings that match known false-positive patterns (e.g., single failed login attempts from a trusted device).
    - Ensure all automated actions are logged with a "notice" or "warning" severity in the audit trail.

### 2. Enhance Security Console UI
- **File**: `src/routes/admin.security.tsx`
- **Logic**:
    - Add an "Automated Maintenance" section to the security header.
    - Implement a detailed "Findings" view for fraud reports that renders the raw `evidence` JSON in a readable format.
    - Add a "Revoke & Lock" shortcut for high-risk findings in the Fraud tab.

### 3. Hardened Audit Retention
- **File**: `src/lib/audit-api.ts`
- **Logic**:
    - Ensure `archiveOldAudit` correctly handles batching to avoid performance hits during large cleanups.
    - Add a `security.maintenance` audit category for these automated tasks.

## Technical Details

- **Severity Mapping**:
    - `critical` (score >= 85): Immediate lock + session revoke.
    - `high` (score >= 60): Session revoke + investigation alert.
    - `medium` (score >= 35): Flag for manual review.
    - `low` (score < 35): Automated dismissal if older than 24h.

## Verification Plan
- Trigger a "Fix All" from the Admin Security console.
- Verify through `audit_logs` that critical findings resulted in `user.lock` and `session.revoke` actions.
- Confirm that the UI correctly displays the resolution status and actor (System vs Admin).