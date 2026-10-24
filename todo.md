
## Role-based PIN access — October 24, 2026

- [x] Replace the single public PIN with admin PIN 0909 and viewer PIN 2026.
- [x] Sign the selected role into the access cookie and expose it through access status.
- [x] Enforce viewer read-only permissions in the server middleware for all business mutations.
- [x] Hide admin-only navigation and write forms for viewer sessions while preserving dashboards, reports, inventory, money, and sales history.
- [x] Add role-specific PIN-screen confirmation and visible viewer/read-only indicators.
- [x] Add role-token regression tests and validate TypeScript, all 53 tests, production build, and diff cleanliness.
