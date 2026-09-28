export type LedgerSale = { packs: number; revenue: number; profit: number };

export function summarizeSales(sales: LedgerSale[]) {
  return sales.reduce(
    (totals, sale) => ({
      packs: totals.packs + sale.packs,
      revenue: totals.revenue + sale.revenue,
      profit: totals.profit + sale.profit,
    }),
    { packs: 0, revenue: 0, profit: 0 },
  );
}
