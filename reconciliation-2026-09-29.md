
## Connected ledger update

- Added one canonical Next Box Fund calculation: **valid-sale COGS recovered − replacement inventory purchases funded by Next Box Fund**.
- Profit distributions, owner capital, and operating expenses are excluded from Next Box Fund.
- Dashboard, Inventory, Money, and Reports now read the shared Next Box Fund value from the dashboard ledger response.
- Next Box Fund purchases are blocked when recovered COGS is insufficient.
- New Owner Capital inventory purchases now require an owner and create a linked posted capital contribution.
- Sales continue to enforce non-negative inventory and create inventory, payment, COGS, and profit entries together.
- Historical allocations remain unchanged.

Validation: **34 tests passed**, TypeScript check passed, production build passed, and live Dashboard/Inventory previews verified the shared Next Box Fund label and value.
