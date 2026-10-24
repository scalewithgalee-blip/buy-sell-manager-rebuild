
## Viewer crash correction — October 24, 2026

- [x] Reproduce the deployed PIN 2026 flow in a real browser.
- [x] Identify React error #310 as a hook-order violation caused by a viewer-navigation useEffect placed after conditional loading/access returns.
- [x] Move the viewer-navigation effect before all conditional returns so admin and viewer renders use identical hook ordering.
- [x] Confirm the deployed API accepts PIN 2026 and returns a working dashboard payload.
- [x] Validate TypeScript, all 53 tests, production build, and diff cleanliness before redeployment.
