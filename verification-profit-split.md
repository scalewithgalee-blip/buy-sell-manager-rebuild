# Daily Profit-Split Verification Notes

**Date:** 2026-09-22

The updated desktop sales screen presents the intended simple workflow: date, read-only operator, rims/packs sold, cash collected, and a collapsed optional note. The computation panel clearly separates revenue, retained capital/COGS, gross profit, and the automatic profit distribution. The displayed default split is Gale 25%, Nikki 25%, and Nikki’s Dad 50%, with the note that 100% of gross profit - not cost or capital - is allocated.

The mobile dashboard remains responsive after the accounting enhancement. It preserves the minimalist white, navy, and violet visual system, with primary sale entry accessible at the top and no layout overflow observed.

Database verification confirmed the three active owners and effective split snapshot: Gale 2,500 basis points, Nikki 2,500, and Nikki’s Dad 5,000. Automated accounting tests passed, including the required 20-pack example: ₱14,600 revenue, ₱14,000 COGS, ₱600 gross profit, and calculated shares of ₱150, ₱150, and ₱300 respectively.

## Owner Profit & Capital Workspace

The desktop and mobile Profit & Capital workspace was verified after enabling direct `#money` navigation. It displays three distinct owner cards: Gale at 25%, Nikki at 25%, and Nikki’s Dad at 50% of gross profit. Each card separates profit earned, profit distributed, profit owed, current capital, capital contributed, and capital withdrawn. The settlement form is visibly labelled as a profit-only action, and the capital ledger is presented separately below it. Both layouts retain readable controls, visual hierarchy, and the existing minimalist violet, navy, and white palette.
