
## Viewer PIN loading fix — October 24, 2026

- [x] Fix public role cookies to use browser-compatible SameSite behavior.
- [x] Confirm PIN 2026 returns a signed viewer role and PIN 0909 returns a signed admin role.
- [x] Diagnose the unexpected viewer crash as an expired database credential in the running backend, not a ledger or PIN problem.
- [x] Refresh the project server environment and verify the viewer dashboard loads from the live database.
- [x] Keep viewer mutations blocked server-side and preserve all business data unchanged.
- [x] Validate TypeScript, all 53 tests, production build, diff cleanliness, and both role endpoints.
