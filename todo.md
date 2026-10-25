
## Inventory-only viewer access — October 25, 2026

The viewer PIN now exposes only the shared Inventory page. Viewer sessions are automatically redirected to Inventory if they enter another hash route, the viewer navigation contains no Dashboard, Sales, Money, Reports, Settings, Data, or Separate Inventory links, and the existing server-side rule still blocks all mutations. Admin access remains unchanged. TypeScript, all 53 tests, production build, and diff checks pass.
