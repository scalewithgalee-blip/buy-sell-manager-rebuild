import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import { EMBEDDED_APP_LOGO } from "@/lib/brandAsset";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  BarChart3,
  Boxes,
  Calculator,
  CheckCircle2,
  Bell,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  DatabaseBackup,
  Download,
  FileArchive,
  Gauge,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Plus,
  ReceiptText,
  Search,
  Settings,
  Sun,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

type View =
  | "dashboard"
  | "sales"
  | "inventory"
  | "money"
  | "reports"
  | "settings"
  | "data";
const viewHash: Record<View, string> = {
  dashboard: "dashboard",
  sales: "sales",
  inventory: "inventory",
  money: "money",
  reports: "reports",
  settings: "settings",
  data: "data",
};
function viewFromHash(hash: string): View {
  const value = hash.replace(/^#/, "");
  return (
    (Object.entries(viewHash).find(([, route]) => route === value)?.[0] as
      | View
      | undefined) ?? "dashboard"
  );
}
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
const peso = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
const pesoDecimal = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(centavos / 100);
const signedPeso = (centavos: number) =>
  centavos === 0
    ? peso(0)
    : `${centavos > 0 ? "+" : "−"}${peso(Math.abs(centavos))}`;
const number = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-PH", { maximumFractionDigits: digits }).format(
    value
  );
const prettyDate = (value: Date | string) =>
  new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
function BrandLogo(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  return <img {...props} src={EMBEDDED_APP_LOGO} />;
}

const demo = {
  settings: {
    minimumInventoryUnits: 50,
    unitsPerBox: 50,
    defaultCostPerUnitCentavos: 70000,
    defaultSellingPriceCentavos: 73000,
    boxCostCentavos: 3500000,
    weeklyUnitsTarget: 100,
    monthlyProfitTargetCentavos: 5000000,
  },
  inventoryUnits: 300,
  inventoryBoxes: 6,
  inventoryValueCentavos: 21000000,
  totalOwnerCapitalCentavos: 21000000,
  nextBoxFundCentavos: 0,
  capitalDeployedCentavos: 21000000,
  capitalDeploymentPercent: 100,
  totalProfitEarnedCentavos: 0,
  totalProfitDistributedCentavos: 0,
  totalProfitOwedCentavos: 0,
  profitDistributedThisWeekCentavos: 0,
  outstandingReceivablesCentavos: 0,
  salesVelocity: 0,
  estimatedDaysUntilStockout: null,
  retainedCash: {
    salesCashCentavos: 0,
    operatingExpensesCentavos: 0,
    retainedCashPurchasesCentavos: 0,
    profitDistributionsCentavos: 0,
    capitalWithdrawalsCentavos: 0,
    availableCentavos: 0,
  },
  periods: {
    today: {
      unitsSold: 0,
      revenueCentavos: 0,
      cogsCentavos: 0,
      grossProfitCentavos: 0,
      netProfitCentavos: 0,
      cashCollectedCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
      grossMarginPercent: 0,
      bestDayUnits: 0,
      worstDayUnits: 0,
    },
    week: {
      unitsSold: 0,
      revenueCentavos: 0,
      grossProfitCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
      averageRevenuePerDay: 0,
      averageProfitPerDay: 0,
    },
    previousWeek: {
      unitsSold: 0,
      revenueCentavos: 0,
      grossProfitCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
      averageRevenuePerDay: 0,
      averageProfitPerDay: 0,
    },
    month: {
      unitsSold: 0,
      revenueCentavos: 0,
      cogsCentavos: 0,
      grossProfitCentavos: 0,
      netProfitCentavos: 0,
      expensesCentavos: 0,
      cashCollectedCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
      grossMarginPercent: 0,
      bestDayUnits: 0,
      worstDayUnits: 0,
    },
    quarter: {
      unitsSold: 0,
      revenueCentavos: 0,
      grossProfitCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
    },
    year: {
      unitsSold: 0,
      revenueCentavos: 0,
      grossProfitCentavos: 0,
      cashVarianceCentavos: 0,
      averageUnitsPerDay: 0,
    },
  },
  weeklyComparison: {
    currentUnitsSold: 0,
    previousUnitsSold: 0,
    unitsDelta: 0,
    percentChange: null as number | null,
    currentWeekStartDate: "",
    currentWeekEndDate: "",
    previousWeekStartDate: "",
    previousWeekEndDate: "",
  },
  weeklyReportHistory: [] as Array<{
    weekStartDate: string;
    weekEndDate: string;
    isCurrent: boolean;
    targetUnits: number | null;
    unitsSold: number;
    unitsRemaining: number | null;
    completionPercent: number | null;
    targetReached: boolean | null;
    cashVarianceCentavos: number;
  }>,
  alerts: [] as Array<{
    id: string;
    kind: "cash_shortage" | "goal_reached";
    tone: "warning" | "success";
    title: string;
    message: string;
    date: string;
  }>,
  ownerSummaries: [
    {
      id: 1,
      name: "Gale",
      capitalContributedCentavos: 14000000,
      capitalWithdrawnCentavos: 0,
      currentCapitalCentavos: 14000000,
      allocatedProfitCentavos: 0,
      profitDistributedCentavos: 0,
      undistributedProfitCentavos: 0,
      totalReceivedCentavos: 0,
      economicInterestCentavos: 14000000,
    },
    {
      id: 2,
      name: "Nikki",
      capitalContributedCentavos: 7000000,
      capitalWithdrawnCentavos: 0,
      currentCapitalCentavos: 7000000,
      allocatedProfitCentavos: 0,
      profitDistributedCentavos: 0,
      undistributedProfitCentavos: 0,
      totalReceivedCentavos: 0,
      economicInterestCentavos: 7000000,
    },
  ],
  salesByDay: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10),
    units: 0,
    revenueCentavos: 0,
  })),
  insights: [
    {
      tone: "good" as const,
      text: "Inventory reconciliation ready: 300 units / 6 box equivalent, with the live sales and capital ledger ready to track.",
    },
  ],
  recentSales: [],
  recentInventory: [
    {
      id: 1,
      transactionDate: new Date("2026-09-22T00:00:00.000Z"),
      transactionType: "initial",
      unitsDelta: 300,
      description: "Physical inventory count  -  300 units",
    },
  ],
  receivables: [],
  capitalTransactions: [
    {
      id: 1,
      transactionDate: new Date("2026-09-22T00:00:00.000Z"),
      transactionType: "capital_contribution",
      status: "posted",
      amountCentavos: 14000000,
      description: "Gale initial capital contribution  -  4 boxes",
    },
    {
      id: 2,
      transactionDate: new Date("2026-09-22T00:00:00.000Z"),
      transactionType: "capital_contribution",
      status: "posted",
      amountCentavos: 7000000,
      description: "Nikki initial capital contribution  -  2 boxes",
    },
    {
      id: 3,
      transactionDate: new Date("2026-09-29T00:00:00.000Z"),
      transactionType: "capital_withdrawal",
      status: "pending",
      amountCentavos: 7000000,
      description: "Gale planned 2-box capital withdrawal",
    },
  ],
  expenses: [],
  recentClosings: [] as any[],
};

const nav: Array<{ key: View; label: string; icon: typeof LayoutDashboard }> = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "sales", label: "Sales", icon: ReceiptText },
  { key: "inventory", label: "Inventory", icon: Package },
  { key: "money", label: "Money", icon: Wallet },
  { key: "reports", label: "Reports", icon: BarChart3 },
  { key: "data", label: "Data & Backups", icon: DatabaseBackup },
  { key: "settings", label: "Settings", icon: Settings },
];

function InfoTip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          onClick={event => event.stopPropagation()}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[#9699aa] transition hover:bg-[#f0efff] hover:text-[#6d5dfc] focus:outline-none focus:ring-2 focus:ring-[#6d5dfc]/30"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-xs bg-[#25213d] text-white"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
function Label({
  children,
  info,
}: {
  children: React.ReactNode;
  info?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8d90a2]">
      {children}
      {info && <InfoTip text={info} />}
    </label>
  );
}
function SectionHeading({
  eyebrow,
  title,
  copy,
  info,
  action,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  info?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6d5dfc]">
          {eyebrow}
        </p>
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-[#17182b]">
            {title}
          </h2>
          {info && <InfoTip text={info} />}
        </div>
        {copy && (
          <p className="mt-1 max-w-2xl text-sm text-[#8d90a2]">{copy}</p>
        )}
      </div>
      {action}
    </div>
  );
}
function MetricCard({
  label,
  value,
  hint,
  info,
  tone = "navy",
  icon: Icon,
  onClick,
  progress,
}: {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  tone?: "navy" | "teal" | "amber" | "coral";
  icon?: typeof Banknote;
  onClick?: () => void;
  progress?: number;
}) {
  const tones = {
    navy: "metric-neutral",
    teal: "metric-lilac",
    amber: "metric-lilac",
    coral: "metric-lilac",
  };
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={event => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
      className={`metric-card ${tones[tone]} ${onClick ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(34,32,73,.09)] focus:outline-none focus:ring-2 focus:ring-[#6d5dfc]/35" : ""}`}
    >
      <div className="relative z-10 flex items-start justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[.14em] opacity-60">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {info && Icon ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} information`}
                  onClick={event => event.stopPropagation()}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/55 opacity-75 shadow-sm transition hover:bg-white hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[#6d5dfc]/30"
                >
                  <Icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                sideOffset={6}
                className="max-w-xs bg-[#25213d] text-white"
              >
                {info}
              </TooltipContent>
            </Tooltip>
          ) : Icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/55 shadow-sm">
              <Icon className="h-4 w-4 opacity-65" />
            </span>
          ) : info ? (
            <InfoTip text={info} />
          ) : null}
        </div>
      </div>
      <p className="relative z-10 mt-4 text-[1.7rem] font-semibold tracking-[-.035em]">
        {value}
      </p>
      {hint && <p className="relative z-10 mt-1 text-xs opacity-65">{hint}</p>}
      {progress !== undefined && (
        <div className="relative z-10 mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[#ebeaf4]">
            <div
              className="h-full rounded-full bg-[#6d5dfc] transition-[width] duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[.1em] opacity-60">
            {number(Math.max(0, Math.min(100, progress)))}% complete
          </p>
        </div>
      )}
    </div>
  );
}

function AlertCenter({
  alerts,
  onOpenReports,
}: {
  alerts: typeof demo.alerts;
  onOpenReports: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            alerts.length
              ? `${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"}`
              : "No active alerts"
          }
          title={
            alerts.length
              ? `${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"}`
              : "No active alerts"
          }
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#e8e9f1] bg-white text-[#6f7284] transition hover:bg-[#f7f7fb] focus:outline-none focus:ring-2 focus:ring-[#6d5dfc]/30"
        >
          <Bell className="h-4 w-4" />
          {alerts.length > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#6d5dfc] px-1 text-[10px] font-bold text-white ring-2 ring-white">
              {alerts.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-[#e8e9f1] bg-white p-0 text-[#17182b] shadow-[0_18px_45px_rgba(34,32,73,.16)]"
      >
        <div className="border-b border-[#eeeef4] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6d5dfc]">
                Business alerts
              </p>
              <h3 className="mt-0.5 font-semibold">
                {alerts.length
                  ? `${alerts.length} active ${alerts.length === 1 ? "alert" : "alerts"}`
                  : "All clear"}
              </h3>
            </div>
            <span
              className={`grid h-9 w-9 place-items-center rounded-xl ${alerts.length ? "bg-[#f0efff] text-[#6d5dfc]" : "bg-[#f7f7fb] text-[#8d90a2]"}`}
            >
              <Bell className="h-4 w-4" />
            </span>
          </div>
        </div>
        {alerts.length ? (
          <div className="max-h-[360px] space-y-2 overflow-y-auto p-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`rounded-xl border p-3 ${alert.tone === "warning" ? "border-[#f5d4d0] bg-[#fff1ef]" : "border-[#ded9ff] bg-[#faf9ff]"}`}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${alert.tone === "warning" ? "bg-white text-[#9d3f35]" : "bg-white text-[#6d5dfc]"}`}
                  >
                    {alert.kind === "cash_shortage" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p
                      className={`text-sm font-semibold ${alert.tone === "warning" ? "text-[#8f2d24]" : "text-[#3f347e]"}`}
                    >
                      {alert.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#64687b]">
                      {alert.message}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#9699aa]">
                      {prettyDate(alert.date)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#6d5dfc]" />
            <p className="mt-3 text-sm font-semibold text-[#2d3040]">
              No active alerts
            </p>
            <p className="mt-1 text-xs leading-5 text-[#8d90a2]">
              Weekly goal progress is below target and no recent cash shortages
              need review.
            </p>
          </div>
        )}
        <div className="border-t border-[#eeeef4] p-3">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onOpenReports();
            }}
            className="btn-secondary w-full justify-center text-xs"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Open Reports
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function Home() {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<View>(() =>
    viewFromHash(window.location.hash)
  );
  const [mobileNav, setMobileNav] = useState(false);
  const [rhythmPeriod, setRhythmPeriod] = useState<"week" | "month" | "custom">(
    "week"
  );
  const [customStartDate, setCustomStartDate] = useState(daysAgo(6));
  const [customEndDate, setCustomEndDate] = useState(today());
  const [sale, setSale] = useState({
    date: today(),
    unitsSold: "",
    cashCollected: "",
    notes: "",
    trancheId: "",
  });
  const [autoCalculateCash, setAutoCalculateCash] = useState(true);
  const [expense, setExpense] = useState({
    date: today(),
    amount: "",
    description: "",
    paidBy: "",
    category: "operating" as const,
  });
  const [inventoryPurchase, setInventoryPurchase] = useState({
    date: today(),
    boxes: "",
    costPerBox: "",
    fundingSource: "retained_cash" as "retained_cash" | "new_capital" | "other",
    ownerId: "",
    notes: "",
  });
  const [capital, setCapital] = useState({
    date: today(),
    amount: "",
    description: "",
    ownerId: "1",
    transactionType: "capital_withdrawal" as const,
    status: "pending" as const,
  });
  const [settingsForm, setSettingsForm] = useState({
    min: "50",
    cost: "700",
    price: "730",
    perBox: "50",
    boxCost: "35000",
    weeklyUnitsTarget: "100",
    monthlyProfitTarget: "50000",
  });
  const [profitSettlement, setProfitSettlement] = useState({
    date: today(),
    ownerId: "",
    amount: "",
    notes: "",
  });
  const [lastSaleResult, setLastSaleResult] = useState<any>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] = useState<
    "all" | "active" | "voided"
  >("all");
  const [showRetainedCashBreakdown, setShowRetainedCashBreakdown] =
    useState(false);
  const [restorePreviewId, setRestorePreviewId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const accessQuery = trpc.access.status.useQuery();
  const accessUnlocked = accessQuery.data?.unlocked === true;
  const dashboardQuery = trpc.business.dashboard.useQuery(undefined, {
    enabled: accessUnlocked,
  });
  const customRangeInput = useMemo(
    () => ({ startDate: customStartDate, endDate: customEndDate }),
    [customStartDate, customEndDate]
  );
  const customRangeValid =
    customStartDate.length === 10 &&
    customEndDate.length === 10 &&
    customStartDate <= customEndDate;
  const customRangeQuery = trpc.business.dashboardRange.useQuery(
    customRangeInput,
    { enabled: accessUnlocked && rhythmPeriod === "custom" && customRangeValid }
  );
  const setupQuery = trpc.business.setup.useQuery(undefined, {
    enabled: accessUnlocked,
  });
  const profitLedgerQuery = trpc.business.profitLedger.useQuery(undefined, {
    enabled: accessUnlocked,
  });
  const historyInput = useMemo(
    () => ({
      page: historyPage,
      pageSize: 25,
      search: historySearch || undefined,
      status: historyStatus,
    }),
    [historyPage, historySearch, historyStatus]
  );
  const historyQuery = trpc.business.salesHistory.useQuery(historyInput, {
    enabled: accessUnlocked,
  });
  const resilienceQuery = trpc.business.dataResilience.useQuery(undefined, {
    enabled: accessUnlocked,
  });
  const restorePreviewQuery = trpc.business.restorePreview.useQuery(
    { backupId: restorePreviewId ?? 1 },
    { enabled: accessUnlocked && restorePreviewId !== null, retry: false }
  );
  const lockAccess = trpc.access.lock.useMutation({
    onSuccess: () => {
      window.location.reload();
    },
    onError: error => toast.error(error.message),
  });
  const dashboard = (dashboardQuery.data ?? demo) as typeof demo &
    Record<string, any>;
  const operatingCash =
    dashboard.operatingCash ?? dashboard.retainedCash ?? demo.retainedCash;
  const ownerCapitalCentavos = (dashboard.ownerSummaries ?? []).reduce(
    (total: number, owner: any) =>
      total + Number(owner.currentCapitalCentavos ?? 0),
    0
  );
  const postedCapitalWithdrawalsCentavos = (
    dashboard.ownerSummaries ?? []
  ).reduce(
    (total: number, owner: any) =>
      total + Number(owner.capitalWithdrawnCentavos ?? 0),
    0
  );
  const nextBoxFundCentavos = Number(
    dashboard.nextBoxFundCentavos ??
      dashboard.nextBoxFund?.availableCentavos ??
      0
  );
  const setup = setupQuery.data;
  const resilience = resilienceQuery.data as any;
  const restorePreview = restorePreviewQuery.data as any;
  const history = historyQuery.data as any;
  const profitLedger = (profitLedgerQuery.data ?? {
    ownerSummaries: [
      {
        id: 1,
        name: "Gale",
        shareBasisPoints: 6667,
        profitEarnedCentavos: 0,
        profitDistributedCentavos: 0,
        profitOwedCentavos: 0,
        capitalContributedCentavos: 14000000,
        capitalWithdrawnCentavos: 0,
        currentCapitalCentavos: 14000000,
      },
      {
        id: 2,
        name: "Nikki",
        shareBasisPoints: 3333,
        profitEarnedCentavos: 0,
        profitDistributedCentavos: 0,
        profitOwedCentavos: 0,
        capitalContributedCentavos: 7000000,
        capitalWithdrawnCentavos: 0,
        currentCapitalCentavos: 7000000,
      },
      {
        id: 3,
        name: "Nikki's Dad",
        shareBasisPoints: 0,
        profitEarnedCentavos: 0,
        profitDistributedCentavos: 0,
        profitOwedCentavos: 0,
        capitalContributedCentavos: 0,
        capitalWithdrawnCentavos: 0,
        currentCapitalCentavos: 0,
      },
    ],
    entries: [],
    capitalHistoryTimeline: [],
  }) as any;
  const addSale = trpc.business.addSale.useMutation({
    onSuccess: (result, variables) => {
      const beforeUnits = dashboard.periods.week.unitsSold;
      const targetUnits = dashboard.settings.weeklyUnitsTarget ?? 100;
      const saleIsCurrentWeek =
        variables.date >= dashboard.weeklyComparison.currentWeekStartDate &&
        variables.date <= dashboard.weeklyComparison.currentWeekEndDate;
      setLastSaleResult(result);
      toast.success(
        `Sale saved  -  ${peso(result.grossProfitCentavos)} gross profit automatically allocated.`
      );
      if (result.cashVarianceCentavos < 0)
        toast.warning(
          `Cash shortage alert: ${peso(Math.abs(result.cashVarianceCentavos))} short of expected sales.`
        );
      if (
        saleIsCurrentWeek &&
        beforeUnits < targetUnits &&
        beforeUnits + variables.unitsSold >= targetUnits
      )
        toast.success(
          `Weekly goal reached: ${number(beforeUnits + variables.unitsSold)} of ${number(targetUnits)} packs/reams sold.`
        );
      setSale({
        date: today(),
        unitsSold: "",
        cashCollected: "",
        notes: "",
        trancheId: "",
      });
      utils.business.dashboard.invalidate();
      utils.business.profitLedger.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const closeDay = trpc.business.closeDay.useMutation({
    onSuccess: result => {
      toast.success(
        result.status === "reconciled"
          ? "Day closed and reconciled."
          : "Day closed  -  review the reconciliation gap."
      );
      utils.business.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const reopenDay = trpc.business.reopenDay.useMutation({
    onSuccess: result => {
      toast.success(
        `${prettyDate(result.closingDate)} reopened. You can correct entries and close it again.`
      );
      utils.business.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const addExpense = trpc.business.addExpense.useMutation({
    onSuccess: () => {
      toast.success("Expense recorded.");
      setExpense({
        date: today(),
        amount: "",
        description: "",
        paidBy: "",
        category: "operating",
      });
      utils.business.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const addCapital = trpc.business.addCapitalTransaction.useMutation({
    onSuccess: () => {
      toast.success("Capital transaction recorded.");
      setCapital({
        date: today(),
        amount: "",
        description: "",
        ownerId: "1",
        transactionType: "capital_withdrawal",
        status: "pending",
      });
      utils.business.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const addInventoryPurchase = trpc.business.addInventoryPurchase.useMutation({
    onSuccess: result => {
      toast.success(
        `${result.boxes} ${result.boxes === 1 ? "box" : "boxes"} added: ${number(result.unitsAdded)} units.`
      );
      setInventoryPurchase({
        date: today(),
        boxes: "",
        costPerBox: "",
        fundingSource: "retained_cash",
        ownerId: "",
        notes: "",
      });
      utils.business.dashboard.invalidate();
      utils.business.dataResilience.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateSettings = trpc.business.updateSettings.useMutation({
    onSuccess: () => {
      toast.success(
        "Business settings updated; transaction history is unchanged."
      );
      utils.business.dashboard.invalidate();
      utils.business.setup.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createBackup = trpc.business.createBackup.useMutation({
    onSuccess: result => {
      toast.success(
        `Offsite ${result.backupType} backup created with ${number(result.recordCount ?? 0)} records.`
      );
      utils.business.dataResilience.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const runIntegrity = trpc.business.runIntegrityCheck.useMutation({
    onSuccess: result => {
      toast.success(
        result.status === "passed"
          ? "Integrity check passed."
          : "Integrity check finished  -  review flagged variance."
      );
      utils.business.dataResilience.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const configureBackups = trpc.business.configureAutomaticBackups.useMutation({
    onSuccess: result => {
      toast.success(
        result.alreadyConfigured
          ? "Automatic daily backup is already configured."
          : "Daily backup schedule configured."
      );
      utils.business.dataResilience.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const voidSale = trpc.business.voidSale.useMutation({
    onSuccess: () => {
      toast.success(
        "Sale voided; inventory and profit allocations were reversed in retained ledger entries."
      );
      utils.business.salesHistory.invalidate();
      utils.business.dashboard.invalidate();
      utils.business.profitLedger.invalidate();
      utils.business.dataResilience.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const recordProfitDistribution =
    trpc.business.recordProfitDistribution.useMutation({
      onSuccess: result => {
        toast.success(
          `Profit distribution saved for ${result.ownerName}; remaining profit owed is ${peso(result.profitOwedCentavos)}.`
        );
        setProfitSettlement({
          date: today(),
          ownerId: "",
          amount: "",
          notes: "",
        });
        utils.business.profitLedger.invalidate();
        utils.business.dashboard.invalidate();
      },
      onError: error => toast.error(error.message),
    });

  useEffect(() => {
    if (setup?.settings)
      setSettingsForm({
        min: String(setup.settings.minimumInventoryUnits),
        cost: String(setup.settings.defaultCostPerUnitCentavos / 100),
        price: String(setup.settings.defaultSellingPriceCentavos / 100),
        perBox: String(setup.settings.unitsPerBox),
        boxCost: String(setup.settings.boxCostCentavos / 100),
        weeklyUnitsTarget: String(setup.settings.weeklyUnitsTarget ?? 100),
        monthlyProfitTarget: String(
          (setup.settings.monthlyProfitTargetCentavos ?? 5_000_000) / 100
        ),
      });
  }, [setup?.settings]);
  useEffect(() => {
    if (!sale.trancheId && setup?.periodOwnerTranches?.length) {
      const preferred = setup.periodOwnerTranches.find(
        (item: any) =>
          item.trancheType !== "guarantee" &&
          setup.businessPeriods?.some(
            (period: any) =>
              period.id === item.periodId && period.status === "open"
          )
      );
      if (preferred)
        setSale(current => ({ ...current, trancheId: String(preferred.id) }));
    }
  }, [setup?.periodOwnerTranches, setup?.businessPeriods, sale.trancheId]);
  const computedSale = useMemo(() => {
    const units = Number(sale.unitsSold) || 0;
    const cashPesos = Number(sale.cashCollected) || 0;
    const costPerUnitCentavos = dashboard.settings.defaultCostPerUnitCentavos;
    const unitPriceCentavos = dashboard.settings.defaultSellingPriceCentavos;
    const profitPerUnitCentavos = Math.max(
      0,
      unitPriceCentavos - costPerUnitCentavos
    );
    const revenueCentavos = units * unitPriceCentavos;
    const cogsCentavos = units * costPerUnitCentavos;
    const grossProfitCentavos = units * profitPerUnitCentavos;
    const rules = [...profitLedger.ownerSummaries]
      .sort((a: any, b: any) => a.id - b.id)
      .map((owner: any) => ({
        ...owner,
        shareBasisPoints:
          owner.currentProfitShareBasisPoints ?? owner.shareBasisPoints ?? 0,
        amountCentavos: Math.floor(
          (grossProfitCentavos *
            (owner.currentProfitShareBasisPoints ??
              owner.shareBasisPoints ??
              0)) /
            10_000
        ),
      }));
    const allocationRemainderCentavos =
      grossProfitCentavos -
      rules.reduce(
        (total: number, owner: any) => total + owner.amountCentavos,
        0
      );
    const firstPositive = rules.find(
      (owner: any) => owner.shareBasisPoints > 0
    );
    if (firstPositive)
      firstPositive.amountCentavos += allocationRemainderCentavos;
    return {
      units,
      revenue: revenueCentavos / 100,
      cogs: cogsCentavos / 100,
      profit: grossProfitCentavos / 100,
      unitPrice: unitPriceCentavos / 100,
      profitPerUnit: profitPerUnitCentavos / 100,
      revenueCentavos,
      cogsCentavos,
      grossProfitCentavos,
      balance: 0,
      cashDiff: cashPesos - revenueCentavos / 100,
      distributions: rules,
    };
  }, [
    sale.unitsSold,
    sale.cashCollected,
    dashboard.settings.defaultCostPerUnitCentavos,
    dashboard.settings.defaultSellingPriceCentavos,
    profitLedger.ownerSummaries,
  ]);
  useEffect(() => {
    if (!autoCalculateCash) return;
    const nextCash =
      computedSale.units > 0
        ? String(Number(computedSale.revenue.toFixed(2)))
        : "";
    setSale(current =>
      current.cashCollected === nextCash
        ? current
        : { ...current, cashCollected: nextCash }
    );
  }, [autoCalculateCash, computedSale.units, computedSale.revenue]);
  useEffect(() => {
    const onHashChange = () => setView(viewFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const latestClosing = dashboard.recentClosings[0] as any;
  const latestClosingDate = latestClosing?.closingDate
    ? new Date(latestClosing.closingDate).toISOString().slice(0, 10)
    : today();
  const isTodayClosed =
    !!latestClosing &&
    latestClosingDate === today() &&
    latestClosing.status !== "reopened";
  const isLive = !!dashboardQuery.data;
  const monthlyProfitGoalCentavos =
    dashboard.settings.monthlyProfitTargetCentavos ?? 5_000_000;
  const monthlyProfitEarnedCentavos = dashboard.periods.month.netProfitCentavos;
  const monthlyProfitRemainingCentavos = Math.max(
    0,
    monthlyProfitGoalCentavos - monthlyProfitEarnedCentavos
  );
  const monthlyProfitGoalProgress = Math.max(
    0,
    Math.min(
      100,
      (monthlyProfitEarnedCentavos / monthlyProfitGoalCentavos) * 100
    )
  );
  const weeklyComparison = dashboard.weeklyComparison ?? demo.weeklyComparison;
  const weeklyReportHistory =
    dashboard.weeklyReportHistory ?? demo.weeklyReportHistory;
  const businessAlerts = dashboard.alerts ?? demo.alerts;
  const weeklyUnitsTarget = dashboard.settings.weeklyUnitsTarget ?? 100;
  const weeklyUnitsRemaining = Math.max(
    0,
    weeklyUnitsTarget - dashboard.periods.week.unitsSold
  );
  const weeklyTargetProgress = Math.max(
    0,
    Math.min(100, (dashboard.periods.week.unitsSold / weeklyUnitsTarget) * 100)
  );
  const weeklyComparisonLabel =
    weeklyComparison.previousUnitsSold === 0
      ? weeklyComparison.currentUnitsSold === 0
        ? "No sales this week or last week"
        : `${number(weeklyComparison.currentUnitsSold)} more than no prior-week sales`
      : weeklyComparison.unitsDelta === 0
        ? "Same total as last week"
        : `${number(Math.abs(weeklyComparison.unitsDelta))} ${weeklyComparison.unitsDelta > 0 ? "more" : "fewer"} than last week • ${number(Math.abs(weeklyComparison.percentChange ?? 0), 1)}% ${weeklyComparison.unitsDelta > 0 ? "higher" : "lower"}`;
  if (accessQuery.isLoading) return <AppLoadingScreen />;
  if (!accessUnlocked)
    return <PublicAccessScreen onUnlocked={() => void accessQuery.refetch()} />;
  if (
    !dashboardQuery.data &&
    (dashboardQuery.isLoading || setupQuery.isLoading)
  )
    return <AppLoadingScreen />;
  const rhythmMetrics =
    rhythmPeriod === "week"
      ? dashboard.periods.week
      : rhythmPeriod === "month"
        ? dashboard.periods.year
        : (customRangeQuery.data?.metrics ?? dashboard.periods.week);
  const rhythmData =
    rhythmPeriod === "week"
      ? (dashboard.salesByWeek ?? dashboard.salesByDay)
      : rhythmPeriod === "month"
        ? (dashboard.salesByMonth ?? dashboard.salesByDay)
        : (customRangeQuery.data?.salesByDay ?? []);
  const mondayFirstLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const rhythmChartData = rhythmData.map((entry: any, index: number) => ({
    ...entry,
    label:
      rhythmPeriod === "week"
        ? mondayFirstLabels[index]
        : rhythmPeriod === "month"
          ? (entry.label ??
            new Date(`${entry.date}T12:00:00`).toLocaleDateString("en", {
              month: "short",
              timeZone: "UTC",
            }))
          : new Date(`${entry.date}T12:00:00`).getUTCDate(),
  }));
  const handleNav = (next: View) => {
    setView(next);
    setMobileNav(false);
    window.location.hash = viewHash[next];
  };
  const submitSale = (event: React.FormEvent) => {
    event.preventDefault();
    if (!setup?.operators?.[0])
      return toast.error("No active operator is configured.");
    addSale.mutate({
      date: sale.date,
      operatorId: setup.operators[0].id,
      unitsSold: Number(sale.unitsSold),
      cashCollectedPesos: Number(sale.cashCollected || 0),
      autoCalculateCash,
      notes: sale.notes || undefined,
    });
  };

  const navGroups = [
    { label: "Overview", items: nav.filter(item => item.key === "dashboard") },
    {
      label: "Operations",
      items: nav.filter(item =>
        ["sales", "inventory", "money", "transition"].includes(item.key)
      ),
    },
    { label: "Analytics", items: nav.filter(item => item.key === "reports") },
    {
      label: "System",
      items: nav.filter(item => ["data", "settings"].includes(item.key)),
    },
  ];
  const sidebar = (
    <aside className="app-sidebar flex h-full w-[252px] shrink-0 flex-col px-4 py-5 text-[#5f6377] lg:max-xl:w-[84px]">
      <div className="mb-2 flex items-center gap-3 px-2 lg:max-xl:justify-center">
        <BrandLogo
          alt="Buy & Sell logo"
          className="h-9 w-9 rounded-xl object-contain"
        />
        <div className="lg:max-xl:hidden">
          <p className="text-sm font-bold tracking-tight text-[#17182b]">
            Buy & Sell
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#aaaabd]">
            Business manager
          </p>
        </div>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto">
        {navGroups.map(group =>
          group.items.length ? (
            <div key={group.label}>
              <p className="nav-section-label lg:max-xl:hidden">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    title={label}
                    onClick={() => handleNav(key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition lg:max-xl:justify-center ${view === key ? "bg-[#f0efff] text-[#5b4de1] shadow-[inset_0_0_0_1px_rgba(109,93,252,.05)]" : "text-[#64687b] hover:bg-[#f7f7fb] hover:text-[#17182b]"}`}
                  >
                    <Icon className="h-[17px] w-[17px] shrink-0" />
                    <span className="lg:max-xl:hidden">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null
        )}
      </nav>
      <div className="mt-4 rounded-xl border border-[#ebeaf4] bg-gradient-to-br from-[#faf9ff] to-[#f4f2ff] p-3 lg:max-xl:hidden">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#3f347e]">
          <ShieldCheck className="h-4 w-4 text-[#6d5dfc]" />
          Protected history
        </div>
        <p className="mt-1 text-[10px] leading-4 text-[#81849a]">
          Corrections are logged, and restore previews never change live
          records.
        </p>
      </div>
      <div className="mt-3 flex items-center gap-1 border-t border-[#ececf2] pt-3">
        <button
          onClick={toggleTheme}
          title={theme === "light" ? "Turn on dark mode" : "Turn off dark mode"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#777b91] transition hover:bg-[#f0efff] hover:text-[#5b4de1]"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </button>
        {isAuthenticated ? (
          <button
            onClick={() => void logout()}
            title="Sign out"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-[#64687b] hover:bg-[#f7f7fb] lg:max-xl:justify-center"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate lg:max-xl:hidden">Sign out</span>
          </button>
        ) : (
          <button
            onClick={() => void lockAccess.mutate()}
            title="Lock public access"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-2 text-left text-xs font-semibold text-[#5b4de1] hover:bg-[#f0efff] lg:max-xl:justify-center"
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="truncate lg:max-xl:hidden">Lock access</span>
          </button>
        )}
      </div>
    </aside>
  );

  const dashboardView = (
    <>
      <SectionHeading
        eyebrow="Dashboard"
        title={`Good morning, ${user?.name?.split(" ")[0] ?? "team"}`}
        info="This dashboard summarizes the live ledger. Changes made from any screen are recorded in the audit trail."
        copy={`${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} • Shared business ledger`}
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleNav("sales")} className="btn-primary">
              <Plus className="h-4 w-4" /> Add daily sale
            </button>
            <button
              disabled={closeDay.isPending || isTodayClosed}
              onClick={() => closeDay.mutate({ date: today() })}
              className="btn-secondary"
            >
              <ClipboardCheck className="h-4 w-4" />{" "}
              {isTodayClosed ? "Day closed" : "Close day"}
            </button>
            {latestClosing && latestClosing.status !== "reopened" && (
              <button
                disabled={reopenDay.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Reopen the latest closed day? The snapshot stays in history and the day can be closed again after corrections."
                    )
                  )
                    reopenDay.mutate({
                      date: latestClosingDate,
                      reason: "Accidental close reopened for correction.",
                    });
                }}
                className="btn-secondary"
              >
                <History className="h-4 w-4" />{" "}
                {reopenDay.isPending ? "Reopening..." : "Reopen last close"}
              </button>
            )}
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard
          label="Today’s sales"
          info="Revenue from today’s non-voided immediate-payment sales."
          value={peso(dashboard.periods.today.revenueCentavos)}
          hint={`${number(dashboard.periods.today.unitsSold)} units sold`}
          icon={Banknote}
        />
        <MetricCard
          label="Today’s profit"
          info="Gross profit is revenue minus product cost. Operating expenses are shown separately."
          value={peso(dashboard.periods.today.grossProfitCentavos)}
          hint="Gross profit before expenses"
          tone="teal"
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Inventory"
          info="Current physical units remaining, converted to box equivalents using the saved units-per-box setting."
          value={`${number(dashboard.inventoryUnits)} units`}
          hint={`${number(dashboard.inventoryBoxes, 2)} boxes · ${peso(dashboard.inventoryValueCentavos)} tied up`}
          tone="amber"
          icon={Package}
        />
        <MetricCard
          label="Next Box Fund"
          value={peso(nextBoxFundCentavos)}
          hint={
            showRetainedCashBreakdown
              ? "Click to hide business position"
              : "Click to view business position"
          }
          info="Owner capital available for the next inventory cycle after posted capital withdrawals. Profit distributions are payouts of earned profit and do not reduce owner capital."
          tone="teal"
          icon={Wallet}
          onClick={() => setShowRetainedCashBreakdown(current => !current)}
        />
        <MetricCard
          label="Weekly target"
          info={`Tracks Monday-to-Sunday packs/reams sold against your saved ${number(weeklyUnitsTarget)}-unit weekly target. Change the target in Settings.`}
          value={`${number(dashboard.periods.week.unitsSold)} of ${number(weeklyUnitsTarget)}`}
          hint={
            weeklyUnitsRemaining > 0
              ? `${number(weeklyUnitsRemaining)} packs/reams to go`
              : "Weekly goal reached"
          }
          progress={weeklyTargetProgress}
          tone={weeklyUnitsRemaining > 0 ? "navy" : "teal"}
          icon={Gauge}
        />
        <MetricCard
          label="Monthly profit goal"
          info={`Tracks net profit after operating expenses against your saved ${peso(monthlyProfitGoalCentavos)} calendar-month target. The goal resets at the start of each month.`}
          value={
            monthlyProfitRemainingCentavos > 0
              ? `${peso(monthlyProfitRemainingCentavos)} to go`
              : "Goal reached"
          }
          hint={`${peso(monthlyProfitEarnedCentavos)} earned of ${peso(monthlyProfitGoalCentavos)}`}
          progress={monthlyProfitGoalProgress}
          tone={monthlyProfitRemainingCentavos > 0 ? "navy" : "teal"}
          icon={Gauge}
        />
      </div>
      {showRetainedCashBreakdown && (
        <section className="panel mt-3 overflow-hidden border border-[#e2defe] bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeef4] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
                Business position
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Owner capital and next box fund
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-[#8d90a2]">
                Owner capital available for the next inventory cycle after
                posted capital withdrawals. Profit distributions are payouts of
                earned profit and do not reduce owner capital.
              </p>
            </div>
            <button
              onClick={() => setShowRetainedCashBreakdown(false)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              Hide details
            </button>
          </div>
          <div className="grid gap-3 border-b border-[#eeeef4] p-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-[#f0efff] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Owner capital
              </p>
              <p className="mt-1 text-lg font-semibold text-[#5b4de1]">
                {peso(ownerCapitalCentavos)}
              </p>
            </div>
            <div className="rounded-lg bg-[#fff1ef] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Profit distributions paid
              </p>
              <p className="mt-1 text-lg font-semibold text-[#9d3f35]">
                −{peso(operatingCash.profitDistributionsCentavos)}
              </p>
            </div>
            <div className="rounded-lg bg-[#fff1ef] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Posted capital withdrawals
              </p>
              <p className="mt-1 text-lg font-semibold text-[#9d3f35]">
                −{peso(postedCapitalWithdrawalsCentavos)}
              </p>
            </div>
            <div className="rounded-lg bg-[#f0efff] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Next box fund
              </p>
              <p className="mt-1 text-lg font-semibold text-[#5b4de1]">
                {peso(nextBoxFundCentavos)}
              </p>
              <p className="mt-1 text-[11px] text-[#8d90a2]">
                Owner capital − posted capital withdrawals
              </p>
            </div>
          </div>
        </section>
      )}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.7fr_.8fr]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeef4] px-5 py-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9699aa]">
                Revenue overview
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#17182b]">
                Sales rhythm
              </h3>
              <p className="mt-1 text-xs text-[#9699aa]">
                {rhythmPeriod === "week"
                  ? "Monday to Sunday • current week"
                  : rhythmPeriod === "month"
                    ? "January to December • current year"
                    : customRangeValid
                      ? `${prettyDate(customStartDate)} to ${prettyDate(customEndDate)}`
                      : "Choose a valid start and end date"}
              </p>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <select
                aria-label="Sales rhythm period"
                value={rhythmPeriod}
                onChange={e =>
                  setRhythmPeriod(e.target.value as "week" | "month" | "custom")
                }
                className="field h-10 w-full min-w-[124px] rounded-xl px-3 py-1 text-sm font-semibold sm:w-auto"
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="custom">Custom</option>
              </select>
              {rhythmPeriod === "custom" && (
                <div className="flex flex-wrap items-end justify-end gap-2 rounded-xl border border-[#e8e9f1] bg-[#fafafd] p-2">
                  <label className="text-[9px] font-bold uppercase tracking-[.12em] text-[#777b91]">
                    From
                    <input
                      type="date"
                      value={customStartDate}
                      max={customEndDate}
                      onChange={e => setCustomStartDate(e.target.value)}
                      className="field mt-1 h-9 w-[132px] px-2 text-xs font-medium normal-case tracking-normal"
                    />
                  </label>
                  <label className="text-[9px] font-bold uppercase tracking-[.12em] text-[#777b91]">
                    To
                    <input
                      type="date"
                      value={customEndDate}
                      min={customStartDate}
                      max={today()}
                      onChange={e => setCustomEndDate(e.target.value)}
                      className="field mt-1 h-9 w-[132px] px-2 text-xs font-medium normal-case tracking-normal"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="p-5">
            {rhythmPeriod === "custom" && !customRangeValid && (
              <div className="mb-4 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9d3f35]">
                Choose an end date on or after the start date.
              </div>
            )}
            {rhythmPeriod === "custom" &&
              customRangeValid &&
              customRangeQuery.isFetching && (
                <div className="mb-4 rounded-xl bg-[#f0efff] p-3 text-sm text-[#5b4de1]">
                  Loading this custom range...
                </div>
              )}
            {rhythmPeriod === "custom" && customRangeQuery.error && (
              <div className="mb-4 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9d3f35]">
                {customRangeQuery.error.message}
              </div>
            )}
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-[#8d90a2]">Revenue</p>
                <p className="mt-1 font-semibold text-[#17182b]">
                  {peso(rhythmMetrics.revenueCentavos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8d90a2]">Gross profit</p>
                <p className="mt-1 font-semibold text-[#5b4de1]">
                  {peso(rhythmMetrics.grossProfitCentavos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8d90a2]">Total packs/reams sold</p>
                <p className="mt-1 font-semibold text-[#17182b]">
                  {number(rhythmMetrics.unitsSold)} packs/reams
                </p>
                {rhythmPeriod === "week" && (
                  <p className="mt-1 text-[11px] leading-4 text-[#8d90a2]">
                    Last week: {number(weeklyComparison.previousUnitsSold)} ·{" "}
                    {weeklyComparisonLabel}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-[#8d90a2]">Best day</p>
                <p className="mt-1 font-semibold text-[#17182b]">
                  {number((rhythmMetrics as any).bestDayUnits ?? 0)} units
                </p>
              </div>
            </div>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={rhythmChartData}
                  margin={{ top: 18, right: 4, left: -26, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="salesArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#7566f5"
                        stopOpacity={0.28}
                      />
                      <stop
                        offset="95%"
                        stopColor="#7566f5"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="#ececf3"
                  />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={
                      rhythmPeriod === "custom" ? "preserveStartEnd" : 0
                    }
                    padding={{ left: 8, right: 12 }}
                    tick={{ fill: "#9799aa", fontSize: 10 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#a3a5b3", fontSize: 10 }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "#7566f5", strokeDasharray: "4 4" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e7e5f3",
                      boxShadow: "0 10px 30px rgba(34,32,73,.12)",
                      fontSize: 12,
                    }}
                    formatter={(value: any) => [
                      `${number(Number(value))} units`,
                      "Sold",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="units"
                    stroke="#6d5dfc"
                    strokeWidth={2.5}
                    fill="url(#salesArea)"
                    activeDot={{
                      r: 5,
                      strokeWidth: 3,
                      fill: "#fff",
                      stroke: "#6d5dfc",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9699aa]">
                Business health
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-[#17182b]">
                At a glance
              </h3>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0efff] text-[#6d5dfc]">
              <Gauge className="h-5 w-5" />
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-[#eeeef4] p-3">
              <span className="text-xs text-[#8d90a2]">Sales velocity</span>
              <p className="mt-1 font-semibold text-[#17182b]">
                {number(dashboard.salesVelocity, 1)} units/day
              </p>
            </div>
            <div className="rounded-xl border border-[#eeeef4] p-3">
              <span className="text-xs text-[#8d90a2]">
                Days until stockout
              </span>
              <p className="mt-1 font-semibold text-[#17182b]">
                {dashboard.estimatedDaysUntilStockout === null
                  ? "Need sales data"
                  : `${number(dashboard.estimatedDaysUntilStockout, 1)} days`}
              </p>
            </div>
            <div className="rounded-xl border border-[#eeeef4] p-3">
              <span className="text-xs text-[#8d90a2]">Collection mode</span>
              <p className="mt-1 font-semibold text-[#5b4de1]">
                Immediate payment
              </p>
            </div>
            <div className="rounded-xl bg-[#f0efff] p-3">
              <span className="text-xs text-[#7669dc]">
                Net profit this month
              </span>
              <p className="mt-1 text-lg font-semibold text-[#3f347e]">
                {peso(dashboard.periods.month.netProfitCentavos)}
              </p>
            </div>
          </div>
        </section>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Attention & insights
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                What the numbers say
              </h3>
            </div>
            <Zap className="h-5 w-5 text-[#6d5dfc]" />
          </div>
          <div className="mt-4 space-y-3">
            {dashboard.insights.map((insight: any, i: number) => (
              <div
                key={i}
                className={`flex gap-3 rounded-xl p-3 text-sm ${insight.tone === "good" ? "bg-[#f0efff] text-[#5b4de1]" : insight.tone === "watch" ? "bg-[#f3f1ff] text-[#5f55b5]" : "bg-[#f7f7fb] text-[#64687b]"}`}
              >
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{insight.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="panel p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Daily close
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Reconciliation status
              </h3>
            </div>
            <ClipboardCheck className="h-5 w-5 text-[#6d5dfc]" />
          </div>
          {dashboard.recentClosings[0] ? (
            <div className="mt-4 rounded-xl bg-[#f0efff] p-4">
              <div className="flex items-center gap-2 font-semibold text-[#5b4de1]">
                <CheckCircle2 className="h-4 w-4" />
                {dashboard.recentClosings[0].status === "reconciled"
                  ? "Reconciled"
                  : dashboard.recentClosings[0].status === "reopened"
                    ? "Open for corrections"
                    : "Needs review"}
              </div>
              <p className="mt-2 text-sm text-[#3c2e90]">
                {dashboard.recentClosings[0].status === "reopened" ? (
                  "This close was reopened. Correct the entries, then close the day again."
                ) : (
                  <>
                    Expected ending inventory:{" "}
                    {dashboard.recentClosings[0].expectedEndingInventoryUnits}{" "}
                    units · Revenue:{" "}
                    {peso(dashboard.recentClosings[0].expectedRevenueCentavos)}
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-[#e8e9f1] p-4 text-sm text-[#8d90a2]">
              Close the day after entering sales. The app will compare expected
              revenue against cash collected.
            </div>
          )}
        </section>
      </div>
    </>
  );

  const salesView = (
    <>
      <SectionHeading
        eyebrow="Daily sales"
        title="Enter sales. Everything else is automatic."
        info="Customers pay immediately. Enter units sold and the app calculates revenue, cost, gross profit, and owner shares."
        copy="Enter the date and packs/reams sold. Auto-calculate expected cash and gross earnings, or turn it off to enter a manual cash variance."
      />
      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <form onSubmit={submitSale} className="panel p-5">
          <div className="mb-5 rounded-lg border border-[#e2defe] bg-[#f3f1ff] px-3 py-2.5 text-sm text-[#5b4de1]">
            <Zap className="mr-2 inline h-4 w-4" />
            Cash-only sale. Each pack/ream is ₱700 cost + ₱30 profit = ₱730 cash
            collected. Future gross profit is split between Gale and Nikki based
            on their current capital contribution; Nikki's Dad receives 0% from
            daily sales.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label info="The accounting date for this sale. Use the actual sale date so weekly and monthly reports stay accurate.">
                Date
              </Label>
              <input
                value={sale.date}
                onChange={e => setSale({ ...sale, date: e.target.value })}
                type="date"
                className="field mt-1"
              />
            </div>
            <div>
              <Label info="The active operator who handled the sale. This is recorded for traceability.">
                Operator
              </Label>
              <div className="mt-1 flex h-11 items-center rounded-md bg-[#f7f7fb] px-3 text-sm font-medium text-[#64687b]">
                {setup?.operators?.[0]?.name ?? "Nikki’s Dad"}
              </div>
            </div>
            <div>
              <Label info="Enter the number of individual packs or reams sold. Revenue, cost, and profit are calculated from this quantity.">
                reams / packs sold
              </Label>
              <input
                required
                min="1"
                inputMode="numeric"
                value={sale.unitsSold}
                onChange={e => setSale({ ...sale, unitsSold: e.target.value })}
                type="number"
                placeholder="20"
                className="field mt-1 text-lg font-semibold"
              />
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <Label info="Actual cash received for the sale. Auto mode fills units sold × ₱730; manual mode lets you record a shortage or other variance.">
                  Cash collected (₱)
                </Label>
                <span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#6d5dfc]">
                  {autoCalculateCash ? "Auto" : "Manual"}
                </span>
              </div>
              <input
                required
                min="0.01"
                inputMode="decimal"
                disabled={autoCalculateCash}
                value={sale.cashCollected}
                onChange={e =>
                  setSale({ ...sale, cashCollected: e.target.value })
                }
                type="number"
                placeholder="14,600"
                className={`field mt-1 text-lg font-semibold ${autoCalculateCash ? "bg-[#f7f7fb] text-[#64687b]" : ""}`}
              />
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-[#e8e9f1] bg-[#f7f7fb] p-3">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={autoCalculateCash}
                onChange={e => setAutoCalculateCash(e.target.checked)}
                className="h-4 w-4 accent-[#6d5dfc]"
              />
              <span className="text-sm font-semibold text-[#2d3040]">
                Auto-calculate cash & earnings
              </span>
            </label>
            <p className="mt-1 pl-7 text-xs leading-5 text-[#8d90a2]">
              {autoCalculateCash
                ? "Expected cash is filled as packs/reams sold × (₱700 cost + ₱30 profit) = ₱730 per pack/ream. Turn this off for shortages, discounts, or other variances."
                : "Manual cash mode is on. Enter what was actually collected; earnings still calculate from the packs/reams sold."}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                  Expected cash
                </p>
                <p className="mt-1 font-semibold text-[#17182b]">
                  {peso(computedSale.revenueCentavos)}
                </p>
              </div>
              <div className="rounded-md bg-white p-3">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                  Gross earnings
                </p>
                <p className="mt-1 font-semibold text-[#6d5dfc]">
                  {peso(computedSale.grossProfitCentavos)}
                </p>
              </div>
            </div>
          </div>
          <details className="mt-4 rounded-md border border-[#e8e9f1] px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-[#64687b]">
              Add an optional variance note
            </summary>
            <textarea
              value={sale.notes}
              onChange={e => setSale({ ...sale, notes: e.target.value })}
              placeholder="Explain any difference from expected cash."
              className="field mt-3 min-h-[76px] resize-none"
            />
          </details>
          <button
            disabled={addSale.isPending}
            className="btn-primary mt-5 w-full justify-center py-3.5"
          >
            {addSale.isPending ? (
              "Saving…"
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Save sale & allocate profit
              </>
            )}
          </button>
        </form>
        <section className="panel metric-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6d5dfc]">
            Calculated automatically
          </p>
          <h3 className="mt-1 text-xl font-semibold">Daily sale result</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#f7f7fb] p-4">
              <p className="text-xs text-[#6d5dfc]">Revenue</p>
              <p className="mt-1 text-xl font-semibold">
                {peso(computedSale.revenueCentavos)}
              </p>
              <p className="mt-1 text-xs text-[#9699aa]">
                {computedSale.units} ×{" "}
                {peso(Math.round(computedSale.unitPrice * 100))}
              </p>
            </div>
            <div className="rounded-lg bg-[#f7f7fb] p-4">
              <p className="text-xs text-[#6d5dfc]">Capital / COGS</p>
              <p className="mt-1 text-xl font-semibold">
                {peso(computedSale.cogsCentavos)}
              </p>
              <p className="mt-1 text-xs text-[#9699aa]">
                Retained in the business
              </p>
            </div>
            <div className="rounded-lg bg-[#f7f7fb] p-4">
              <p className="text-xs text-[#6d5dfc]">Gross profit</p>
              <p className="mt-1 text-xl font-semibold text-[#6d5dfc]">
                {peso(computedSale.grossProfitCentavos)}
              </p>
              <p className="mt-1 text-xs text-[#9699aa]">Allocated below</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-[#f7f7fb] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[.14em] text-[#6d5dfc]">
                Preview before save
              </p>
              <span className="text-xs text-[#6d5dfc]">Exact saved split</span>
            </div>
            <div className="space-y-2">
              {computedSale.distributions.map((owner: any) => (
                <div
                  key={owner.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span>
                    {owner.name}{" "}
                    <span className="text-[#7566f5]">
                      {(owner.shareBasisPoints / 100).toFixed(2)}%
                    </span>
                  </span>
                  <strong>{peso(owner.amountCentavos)}</strong>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-[#8d90a2]">
              Amounts use the current capital-weighted shares and the same
              centavo rounding as the saved ledger entries.
            </p>
          </div>
          <div
            className={`mt-4 rounded-lg p-3 text-sm ${computedSale.cashDiff === 0 ? "bg-[#f0efff] text-[#5b4de1]" : "bg-[#fff1ef] text-[#9d3f35]"}`}
          >
            <strong>
              {computedSale.cashDiff === 0
                ? "Cash reconciles."
                : "Cash variance:"}
            </strong>{" "}
            {computedSale.cashDiff === 0
              ? "full payment received."
              : `${peso(Math.round(Math.abs(computedSale.cashDiff) * 100))} difference from expected revenue; this never becomes a customer balance.`}
          </div>
        </section>
      </div>
      {lastSaleResult && (
        <section className="panel mt-5 overflow-hidden">
          <div className="border-b border-[#eeeef4] px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
              Saved result · {lastSaleResult.saleCode}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
              {lastSaleResult.saleId
                ? "Sale saved and owner profits recorded"
                : "Latest saved sale"}
            </h3>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-4">
            <LedgerStat
              label="Units sold"
              value={String(
                lastSaleResult.expectedRevenueCentavos /
                  (dashboard.settings.defaultSellingPriceCentavos || 1)
              )}
            />
            <LedgerStat
              label="Revenue"
              value={peso(lastSaleResult.expectedRevenueCentavos)}
            />
            <LedgerStat
              label="Capital / COGS"
              value={peso(lastSaleResult.cogsCentavos)}
            />
            <LedgerStat
              label="Gross profit"
              value={peso(lastSaleResult.grossProfitCentavos)}
              emphasis
            />
          </div>
          <ProfitSplitTable entries={lastSaleResult.profitDistribution ?? []} />
        </section>
      )}
      <section className="panel mt-5 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
              Recent sales
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
              Immediate-payment transactions
            </h3>
          </div>
        </div>
        <SalesTable items={dashboard.recentSales} />
      </section>
    </>
  );
  const inventoryView = (
    <>
      <SectionHeading
        eyebrow="Stock control"
        title="Inventory ledger"
        info="Inventory is the physical stock ledger. Purchases add units; sales, losses, and adjustments reduce or correct units through retained records."
        copy="Stock only moves through a recorded opening balance, purchase, sale, loss, adjustment, or reversal."
      />
      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Units remaining"
          value={`${number(dashboard.inventoryUnits)} units`}
          hint={`${number(dashboard.inventoryBoxes, 2)} box equivalent`}
          tone="navy"
          icon={Package}
        />
        <MetricCard
          label="Inventory value"
          value={peso(dashboard.inventoryValueCentavos)}
          hint={`${peso(dashboard.settings.defaultCostPerUnitCentavos)} acquisition cost per unit`}
          tone="amber"
          icon={Banknote}
        />
        <MetricCard
          label="Next Box Fund"
          value={peso(nextBoxFundCentavos)}
          hint="Recovered COGS available for replacement inventory"
          tone="teal"
          icon={Wallet}
        />
        <MetricCard
          label="Restock threshold"
          value={`${number(dashboard.settings.minimumInventoryUnits)} units`}
          hint={
            dashboard.inventoryUnits <= dashboard.settings.minimumInventoryUnits
              ? "RESTOCK NEEDED"
              : `${number(dashboard.inventoryUnits - dashboard.settings.minimumInventoryUnits)} units above minimum`
          }
          tone={
            dashboard.inventoryUnits <= dashboard.settings.minimumInventoryUnits
              ? "coral"
              : "teal"
          }
          icon={Boxes}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <form
          onSubmit={e => {
            e.preventDefault();
            const boxes = Number(inventoryPurchase.boxes);
            const costPerBox = Number(
              inventoryPurchase.costPerBox ||
                dashboard.settings.boxCostCentavos / 100
            );
            if (!Number.isInteger(boxes) || boxes <= 0)
              return toast.error("Enter at least one whole box.");
            addInventoryPurchase.mutate({
              date: inventoryPurchase.date,
              boxes,
              unitsPerBox: dashboard.settings.unitsPerBox,
              costPerBoxPesos: costPerBox,
              fundingSource: inventoryPurchase.fundingSource,
              ownerId:
                inventoryPurchase.fundingSource === "new_capital"
                  ? Number(inventoryPurchase.ownerId)
                  : undefined,
              notes: inventoryPurchase.notes || undefined,
            });
          }}
          className="panel p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
            Inventory purchase
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Add additional boxes
          </h3>
          <p className="mt-1 text-sm leading-5 text-[#8d90a2]">
            Record new stock when you purchase more boxes. Next Box Fund
            purchases consume recovered COGS without changing owner capital or
            profit; new owner capital is recorded as a separate capital
            contribution.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label info="The date the additional boxes entered your physical inventory.">
                Purchase date
              </Label>
              <input
                required
                type="date"
                value={inventoryPurchase.date}
                onChange={e =>
                  setInventoryPurchase({
                    ...inventoryPurchase,
                    date: e.target.value,
                  })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label info="Enter whole boxes only. Units added equals boxes purchased × units per box.">
                Boxes purchased
              </Label>
              <input
                required
                min="1"
                step="1"
                type="number"
                value={inventoryPurchase.boxes}
                onChange={e =>
                  setInventoryPurchase({
                    ...inventoryPurchase,
                    boxes: e.target.value,
                  })
                }
                placeholder="2"
                className="field mt-1 text-lg font-semibold"
              />
            </div>
            <div>
              <Label info="The acquisition cost for one box, not the selling price of individual packs.">
                Cost per box (₱)
              </Label>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={
                  inventoryPurchase.costPerBox ||
                  String(dashboard.settings.boxCostCentavos / 100)
                }
                onChange={e =>
                  setInventoryPurchase({
                    ...inventoryPurchase,
                    costPerBox: e.target.value,
                  })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label info="The number of individual packs or reams contained in one box.">
                Units per box
              </Label>
              <div className="mt-1 flex h-11 items-center rounded-md bg-[#f7f7fb] px-3 text-sm font-semibold text-[#64687b]">
                {number(dashboard.settings.unitsPerBox)} units
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#f0efff] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Units added
              </p>
              <p className="mt-1 text-lg font-semibold text-[#5b4de1]">
                {number(
                  (Number(inventoryPurchase.boxes) || 0) *
                    dashboard.settings.unitsPerBox
                )}
              </p>
            </div>
            <div className="rounded-lg bg-[#f7f7fb] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                Purchase total
              </p>
              <p className="mt-1 text-lg font-semibold text-[#17182b]">
                {peso(
                  Math.round(
                    (Number(inventoryPurchase.boxes) || 0) *
                      Number(
                        inventoryPurchase.costPerBox ||
                          dashboard.settings.boxCostCentavos / 100
                      ) *
                      100
                  )
                )}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <Label info="Next Box Fund is recovered COGS from inventory already sold. New owner capital is a separate source that changes capital and future profit shares.">
              Funding source
            </Label>
            <select
              value={inventoryPurchase.fundingSource}
              onChange={e =>
                setInventoryPurchase({
                  ...inventoryPurchase,
                  fundingSource: e.target.value as
                    | "retained_cash"
                    | "new_capital"
                    | "other",
                })
              }
              className="field mt-1"
            >
              <option value="retained_cash">
                Next Box Fund from recovered COGS
              </option>
              <option value="new_capital">
                New Owner Capital (linked contribution)
              </option>
              <option value="other">Other funding</option>
            </select>
            <p className="mt-1 text-xs leading-5 text-[#8d90a2]">
              Choose Next Box Fund when replacing inventory sold previously.
              This adds inventory, consumes recovered COGS, and does not change
              owner capital or profit.
            </p>
          </div>
          {inventoryPurchase.fundingSource === "new_capital" && (
            <div className="mt-3">
              <Label info="The selected owner will receive a posted capital contribution equal to this inventory purchase total.">
                Capital provider
              </Label>
              <select
                required
                value={inventoryPurchase.ownerId}
                onChange={e =>
                  setInventoryPurchase({
                    ...inventoryPurchase,
                    ownerId: e.target.value,
                  })
                }
                className="field mt-1"
              >
                <option value="">Select owner</option>
                {(dashboard.ownerSummaries ?? [])
                  .filter((owner: any) => owner.name !== "Nikki's Dad")
                  .map((owner: any) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div className="mt-3">
            <Label>Optional note</Label>
            <input
              value={inventoryPurchase.notes}
              onChange={e =>
                setInventoryPurchase({
                  ...inventoryPurchase,
                  notes: e.target.value,
                })
              }
              placeholder="Supplier or delivery note"
              className="field mt-1"
            />
          </div>
          <button
            disabled={addInventoryPurchase.isPending}
            className="btn-primary mt-5 w-full justify-center"
          >
            {addInventoryPurchase.isPending
              ? "Adding inventory…"
              : "Add boxes to inventory"}
          </button>
        </form>
        <section className="panel overflow-hidden">
          <div className="px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
              Traceable movements
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
              Inventory transactions
            </h3>
          </div>
          <div className="divide-y divide-[#eeeef4]">
            {dashboard.recentInventory.map((item: any) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#2d3040]">
                    {item.description || item.transactionType}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8d90a2]">
                    {prettyDate(item.transactionDate)} ·{" "}
                    {String(item.transactionType).replace("_", " ")}
                    {item.transactionType === "purchase" && (
                      <>
                        {" "}
                        ·{" "}
                        {item.fundingSource === "retained_cash"
                          ? "Next Box Fund"
                          : item.fundingSource === "new_capital"
                            ? "new owner capital"
                            : item.fundingSource === "other"
                              ? "other funding"
                              : "legacy record"}
                      </>
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-lg px-2.5 py-1 text-sm font-semibold ${item.unitsDelta >= 0 ? "bg-[#f0efff] text-[#5b4de1]" : "bg-[#fff1ef] text-[#9d3f35]"}`}
                >
                  {item.unitsDelta >= 0 ? "+" : ""}
                  {item.unitsDelta} units
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );

  const moneyView = (
    <>
      <SectionHeading
        eyebrow="Owner settlement"
        title="Profit & capital"
        info="Capital is the money invested or returned. Profit is earned from sales and settled separately, so one cannot silently change the other."
        copy="Profit earned is calculated from sales. Profit distributions reduce only profit owed; they never change contributed or withdrawn capital."
      />
      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <LedgerStat
          label="Total investor capital"
          value={peso(profitLedger.totalInvestorCapitalCentavos ?? 0)}
        />
        <LedgerStat
          label="Daily gross profit"
          value={peso(profitLedger.dailyGrossProfitCentavos ?? 0)}
          emphasis
        />
        <div className="rounded-xl border border-[#e2defe] bg-[#f3f1ff] p-4 text-sm leading-5 text-[#3f347e]">
          Daily gross profit is allocated between Gale and Nikki based on their
          current capital contribution. Nikki's Dad receives 0% from daily
          sales; his settlement is handled separately.
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {profitLedger.ownerSummaries.map((owner: any) => (
          <section key={owner.id} className="panel p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                  {owner.name}
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#17182b]">
                  {(
                    (owner.currentProfitShareBasisPoints ??
                      owner.shareBasisPoints ??
                      0) / 100
                  ).toFixed(2)}
                  % current profit share
                </h3>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-md bg-[#f0efff] text-[#6d5dfc]">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <LedgerStat
                label="Profit earned"
                value={peso(owner.profitEarnedCentavos)}
              />
              <LedgerStat
                label="Profit distributed"
                value={peso(owner.profitDistributedCentavos)}
              />
              <LedgerStat
                label="Profit owed"
                value={peso(owner.profitOwedCentavos)}
                emphasis
              />
              <LedgerStat
                label="Current capital"
                value={peso(owner.currentCapitalCentavos)}
              />
              <LedgerStat
                label="Capital contributed"
                value={peso(owner.capitalContributedCentavos)}
              />
              <LedgerStat
                label="Capital withdrawn"
                value={peso(owner.capitalWithdrawnCentavos)}
              />
            </div>
          </section>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <form
          onSubmit={e => {
            e.preventDefault();
            recordProfitDistribution.mutate({
              date: profitSettlement.date,
              ownerId: Number(profitSettlement.ownerId),
              amountPesos: Number(profitSettlement.amount),
              notes: profitSettlement.notes || undefined,
            });
          }}
          className="panel p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
            Profit settlement
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Record profit distribution
          </h3>
          <p className="mt-1 text-sm leading-5 text-[#8d90a2]">
            Use this only for actual profit paid out. It will not affect capital
            balances.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Date</Label>
              <input
                required
                type="date"
                value={profitSettlement.date}
                onChange={e =>
                  setProfitSettlement({
                    ...profitSettlement,
                    date: e.target.value,
                  })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Owner</Label>
              <select
                required
                value={profitSettlement.ownerId}
                onChange={e =>
                  setProfitSettlement({
                    ...profitSettlement,
                    ownerId: e.target.value,
                  })
                }
                className="field mt-1"
              >
                <option value="">Choose owner</option>
                {profitLedger.ownerSummaries.map((owner: any) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name} · owed {peso(owner.profitOwedCentavos)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Amount (₱)</Label>
              <input
                required
                min="0.01"
                step="0.01"
                type="number"
                value={profitSettlement.amount}
                onChange={e =>
                  setProfitSettlement({
                    ...profitSettlement,
                    amount: e.target.value,
                  })
                }
                placeholder="3,000"
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Optional note</Label>
              <input
                value={profitSettlement.notes}
                onChange={e =>
                  setProfitSettlement({
                    ...profitSettlement,
                    notes: e.target.value,
                  })
                }
                placeholder="Cash settlement"
                className="field mt-1"
              />
            </div>
          </div>
          <button
            disabled={recordProfitDistribution.isPending}
            className="btn-primary mt-5 w-full justify-center"
          >
            {recordProfitDistribution.isPending
              ? "Recording…"
              : "Record profit distribution"}
          </button>
        </form>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#eeeef4] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Owner profit ledger
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Earned & distributed history
              </h3>
            </div>
            <CircleDollarSign className="h-5 w-5 text-[#6d5dfc]" />
          </div>
          {profitLedger.entries?.length ? (
            <div className="divide-y divide-[#eeeef4]">
              {profitLedger.entries.slice(0, 10).map((entry: any) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#2d3040]">
                      {entry.description}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8d90a2]">
                      {prettyDate(entry.entryDate)} · {entry.recordCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${entry.entryType === "distributed" ? "text-[#9d3f35]" : "text-[#5b4de1]"}`}
                    >
                      {entry.entryType === "distributed" ? "−" : "+"}
                      {peso(Math.abs(entry.amountCentavos))}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8d90a2]">
                      {entry.entryType}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Each saved sale will add gross-profit shares here automatically." />
          )}
        </section>
      </div>
      <section className="panel mt-5 overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
            Capital ledger
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Capital remains separate from profit
          </h3>
        </div>
        <div className="divide-y divide-[#eeeef4]">
          {dashboard.capitalTransactions.map((item: any) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-5 py-3"
            >
              <div>
                <p className="text-sm font-semibold capitalize text-[#2d3040]">
                  {String(item.transactionType).replaceAll("_", " ")}
                </p>
                <p className="mt-0.5 text-xs text-[#8d90a2]">
                  {prettyDate(item.transactionDate)} · {item.description}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-[#17182b]">
                  {peso(item.amountCentavos)}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6d5dfc]">
                  {item.status}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="panel mt-5 overflow-hidden">
        <div className="border-b border-[#eeeef4] px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
            Capital history
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Allocation percentage timeline
          </h3>
          <p className="mt-1 text-sm leading-5 text-[#8d90a2]">
            Each entry shows when posted capital changed the future daily profit
            split. Existing sale allocations are never rewritten.
          </p>
        </div>
        {profitLedger.capitalHistoryTimeline?.length ? (
          <div className="divide-y divide-[#eeeef4]">
            {profitLedger.capitalHistoryTimeline
              .slice()
              .reverse()
              .map((event: any, index: number) => (
                <div
                  key={`${event.id}-${event.effectiveDate}`}
                  className="flex gap-4 px-5 py-4"
                >
                  <div className="flex w-6 shrink-0 flex-col items-center">
                    <span className="mt-1 h-3 w-3 rounded-full bg-[#6d5dfc] ring-4 ring-[#f0efff]" />
                    {index < profitLedger.capitalHistoryTimeline.length - 1 && (
                      <span className="mt-2 h-full w-px bg-[#e8e9f1]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#2d3040]">
                          {prettyDate(event.effectiveDate)} ·{" "}
                          {event.changedOwnerName}{" "}
                          {event.transactionType === "capital_contribution"
                            ? "contributed"
                            : "withdrew"}{" "}
                          {peso(event.amountCentavos)}
                        </p>
                        <p className="mt-1 text-xs text-[#8d90a2]">
                          Capital after change: Gale{" "}
                          {peso(event.galeCurrentCapitalCentavos)} · Nikki{" "}
                          {peso(event.nikkiCurrentCapitalCentavos)}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f0efff] px-2.5 py-1 text-xs font-bold text-[#5b4de1]">
                        Gale {(event.galeShareBasisPoints / 100).toFixed(2)}% ·
                        Nikki {(event.nikkiShareBasisPoints / 100).toFixed(2)}%
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#9699aa]">
                      Nikki’s Dad · 0.00% daily-sale share ·{" "}
                      {peso(event.totalInvestorCapitalCentavos)} total capital
                    </p>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <Empty text="Posted capital changes will appear here as allocation percentages change." />
        )}
      </section>
    </>
  );
  const dataView = (
    <>
      <SectionHeading
        eyebrow="Resilience center"
        title="Data & Backups"
        info="Backups and exports are recovery tools. They do not replace the live database and should be tested before any restore."
        copy="The database is the source of truth. Financial records are retained; backups and exports are stored separately from the live database."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              disabled={createBackup.isPending}
              onClick={() => createBackup.mutate({ type: "manual" })}
              className="btn-primary"
            >
              <FileArchive className="h-4 w-4" />{" "}
              {createBackup.isPending ? "Creating…" : "Export business data"}
            </button>
            <button
              disabled={runIntegrity.isPending}
              onClick={() => runIntegrity.mutate()}
              className="btn-secondary"
            >
              <ShieldCheck className="h-4 w-4" />{" "}
              {runIntegrity.isPending ? "Checking…" : "Run integrity check"}
            </button>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Last successful backup"
          value={
            resilience?.lastSuccessfulBackupAt
              ? prettyDate(resilience.lastSuccessfulBackupAt)
              : "Not created"
          }
          hint={
            resilience?.backupStatus === "successful" ||
            resilience?.backupStatus === "verified"
              ? "Offsite archive available"
              : "Create an initial export now"
          }
          tone={resilience?.lastSuccessfulBackupAt ? "teal" : "amber"}
          icon={DatabaseBackup}
        />
        <MetricCard
          label="Sales records"
          value={number(resilience?.totalSales ?? 0)}
          hint="Stored in the persistent database"
          icon={ReceiptText}
        />
        <MetricCard
          label="Total transactions"
          value={number(resilience?.totalTransactions ?? 0)}
          hint="Sales, inventory, capital & expenses"
          tone="teal"
          icon={History}
        />
        <MetricCard
          label="Latest export"
          value={
            resilience?.latestExportAt
              ? prettyDate(resilience.latestExportAt)
              : "Not yet exported"
          }
          hint="Complete ZIP of CSV tables"
          tone="amber"
          icon={Download}
        />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <section className="panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Automatic offsite protection
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Daily, weekly & monthly retention
              </h3>
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${resilience?.backupScheduleTaskUid ? "bg-[#f0efff] text-[#5b4de1]" : "bg-[#f3f1ff] text-[#5b4de1]"}`}
            >
              {resilience?.backupScheduleTaskUid
                ? "Scheduled daily"
                : "Needs activation"}
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <LedgerStat
              label="Daily retention"
              value={resilience?.retention?.daily ?? "30 days"}
            />
            <LedgerStat
              label="Weekly retention"
              value={resilience?.retention?.weekly ?? "12 weeks"}
            />
            <LedgerStat
              label="Monthly retention"
              value={resilience?.retention?.monthly ?? "12 months"}
            />
          </div>
          <p className="mt-4 text-sm leading-6 text-[#64687b]">
            Each archive includes a branded sales receipt header, a manifest,
            and complete CSV files for sales, inventory, capital, expenses,
            payments, owners, daily closings, audit events, and supporting data.
            Archives are stored offsite from the live database.
          </p>
          <button
            disabled={
              !!resilience?.backupScheduleTaskUid ||
              configureBackups.isPending ||
              import.meta.env.DEV
            }
            onClick={() => configureBackups.mutate()}
            className="btn-secondary mt-4"
          >
            {configureBackups.isPending
              ? "Activating…"
              : resilience?.backupScheduleTaskUid
                ? "Automatic backups active"
                : import.meta.env.DEV
                  ? "Publish to activate schedule"
                  : "Activate daily backups"}
          </button>
          <p className="mt-2 text-[11px] text-[#8d90a2]">
            Scheduled backups activate only from the published app. The daily
            run automatically adds weekly and monthly restore points on their
            due dates.
          </p>
        </section>
        <section className="panel metric-card p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#6d5dfc]">
            Restore playbook
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            Recover without rewriting history
          </h3>
          <ol className="mt-4 space-y-3 text-sm leading-5 text-[#e2defe]">
            <li>
              <strong className="text-white">1. Download</strong> a successful
              ZIP archive below.
            </li>
            <li>
              <strong className="text-white">2. Test restore</strong> its CSV
              tables into a separate database first.
            </li>
            <li>
              <strong className="text-white">3. Verify</strong> sales,
              inventory, capital, expenses, and closings against the manifest.
            </li>
            <li>
              <strong className="text-white">4. Restore production</strong> only
              after comparison and admin approval.
            </li>
          </ol>
          <p className="mt-5 rounded-xl bg-[#f7f7fb] p-3 text-xs text-[#6d5dfc]">
            The app does not provide one-click destructive restore. Financial
            history is protected through voids/reversals, audit logs, and
            separate backup artifacts.
          </p>
        </section>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Backup history
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Available restore points
              </h3>
            </div>
            <Clock3 className="h-5 w-5 text-[#6d5dfc]" />
          </div>
          {resilience?.records?.length ? (
            <div className="divide-y divide-[#eeeef4]">
              {resilience.records.map((record: any) => (
                <div
                  key={record.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#2d3040]">
                      {record.recordCode}
                    </p>
                    <p className="mt-1 text-xs text-[#8d90a2]">
                      {record.backupType} · {prettyDate(record.createdAt)} ·{" "}
                      {number(record.recordCount ?? 0)} records ·{" "}
                      {record.sizeBytes
                        ? `${number(record.sizeBytes / 1024, 1)} KB`
                        : "preparing"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${record.status === "successful" || record.status === "verified" ? "bg-[#f0efff] text-[#5b4de1]" : record.status === "failed" ? "bg-[#fff1ef] text-[#9d3f35]" : "bg-[#f3f1ff] text-[#5b4de1]"}`}
                    >
                      {record.status}
                    </span>
                    {record.downloadUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => setRestorePreviewId(record.id)}
                          className="rounded-lg border border-[#e8e9f1] px-2.5 py-1.5 text-xs font-semibold text-[#64687b] hover:bg-[#f7f7fb]"
                        >
                          <Search className="mr-1 inline h-3.5 w-3.5" />
                          Preview restore
                        </button>
                        <a
                          href={`/api/backups/${record.id}/download`}
                          download={`${record.recordCode}.zip`}
                          className="rounded-lg border border-[#e8e9f1] px-2.5 py-1.5 text-xs font-semibold text-[#6d5dfc] hover:bg-[#f3f1ff]"
                        >
                          <Download className="mr-1 inline h-3.5 w-3.5" />
                          Download
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="No backups yet. Create a full export to establish your first restore point." />
          )}
        </section>
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Integrity history
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Non-destructive checks
              </h3>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#6d5dfc]" />
          </div>
          {resilience?.integrityChecks?.length ? (
            <div className="divide-y divide-[#eeeef4]">
              {resilience.integrityChecks.slice(0, 6).map((check: any) => (
                <div key={check.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs font-semibold text-[#2d3040]">
                      {check.recordCode}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${check.status === "passed" ? "bg-[#f0efff] text-[#5b4de1]" : "bg-[#f3f1ff] text-[#5b4de1]"}`}
                    >
                      {check.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#8d90a2]">
                    Inventory: {check.inventoryVarianceUnits} units · Cash:{" "}
                    {peso(check.cashVarianceCentavos)} · Ownership:{" "}
                    {(check.ownershipVarianceBasisPoints / 100).toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Run an integrity check to create a timestamped reconciliation record." />
          )}
        </section>
      </div>
      <section className="panel mt-5 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
              Scalable sales history
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
              Paginated records - {number(history?.total ?? 0)} total
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#9699aa]" />
              <input
                value={historySearch}
                onChange={e => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search transaction ID or note"
                className="field h-9 w-56 pl-9 text-sm"
              />
            </div>
            <select
              value={historyStatus}
              onChange={e => {
                setHistoryStatus(e.target.value as any);
                setHistoryPage(1);
              }}
              className="field h-9 w-28 text-sm"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="voided">Voided</option>
            </select>
          </div>
        </div>
        <DataSalesTable
          items={history?.rows ?? []}
          onVoid={item => {
            const reason = window.prompt(
              `Void ${item.recordCode ?? `sale #${item.id}`}? Enter a reason. The original will be retained and inventory reversed.`
            );
            if (reason?.trim()) voidSale.mutate({ saleId: item.id, reason });
          }}
          canVoid={!voidSale.isPending}
        />
        <div className="flex items-center justify-between border-t border-[#eeeef4] px-5 py-3 text-sm">
          <span className="text-[#8d90a2]">
            Page {history?.page ?? 1} of {history?.totalPages ?? 1}
          </span>
          <div className="flex gap-2">
            <button
              disabled={(history?.page ?? 1) <= 1}
              onClick={() => setHistoryPage(page => Math.max(1, page - 1))}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={(history?.page ?? 1) >= (history?.totalPages ?? 1)}
              onClick={() => setHistoryPage(page => page + 1)}
              className="btn-secondary px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <section className="panel mt-5 overflow-hidden">
        <div className="px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
            Recent audit events
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Who changed what
          </h3>
        </div>
        {resilience?.auditEvents?.length ? (
          <div className="divide-y divide-[#eeeef4]">
            {resilience.auditEvents.slice(0, 8).map((event: any) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#2d3040]">
                    {event.action} · {event.entityType}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8d90a2]">
                    {event.entityId ?? "system"}
                  </p>
                </div>
                <p className="max-w-md text-right text-xs text-[#8d90a2]">
                  {event.details ?? "Recorded change"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <Empty text="Audit events will appear here as financial records and settings are created, voided, or updated." />
        )}
      </section>
    </>
  );

  const reportsView = (
    <>
      <SectionHeading
        eyebrow="Performance"
        title="Reports"
        info="Reports summarize recorded transactions. Weeks always run Monday through Sunday, and target history keeps the goal saved for each week."
        copy="Review sales, goals, and cash collection differences using recorded ledger data only."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <section className="panel p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6d5dfc]">
            Replacement cycle
          </p>
          <p className="mt-3 text-2xl font-semibold text-[#17182b]">
            {peso(nextBoxFundCentavos)}
          </p>
          <p className="mt-2 text-sm text-[#8d90a2]">
            Next Box Fund available from recovered COGS.
          </p>
        </section>
        {(["week", "month", "quarter", "year"] as const).map(key => (
          <section key={key} className="panel p-5">
            <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6d5dfc]">
              This {key}
            </p>
            <p className="mt-3 text-2xl font-semibold text-[#17182b]">
              {number(dashboard.periods[key].unitsSold)} units
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#8d90a2]">Revenue</span>
                <span className="font-medium">
                  {peso(dashboard.periods[key].revenueCentavos)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8d90a2]">Gross profit</span>
                <span className="font-medium text-[#6d5dfc]">
                  {peso(dashboard.periods[key].grossProfitCentavos)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8d90a2]">Cash variance</span>
                <span
                  className={`font-medium ${dashboard.periods[key].cashVarianceCentavos === 0 ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                >
                  {signedPeso(dashboard.periods[key].cashVarianceCentavos)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#8d90a2]">Avg/day</span>
                <span className="font-medium">
                  {number(dashboard.periods[key].averageUnitsPerDay, 1)}
                </span>
              </div>
            </div>
          </section>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <section className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eeeef4] px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
                  Weekly target history
                </p>
                <InfoTip text="Each row uses a Monday-to-Sunday week and preserves the target saved for that week. Changing Settings updates only the current week and future weeks." />
              </div>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Goal performance by week
              </h3>
              <p className="mt-1 text-sm text-[#8d90a2]">
                The current week runs through today. Completed weeks cover the
                full Monday-to-Sunday period.
              </p>
            </div>
            <span className="rounded-full bg-[#f0efff] px-3 py-1.5 text-xs font-semibold text-[#5b4de1]">
              Last 12 weeks
            </span>
          </div>
          {weeklyReportHistory.length ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-[#f7f7fb] text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                    <tr>
                      <th className="px-5 py-3">Week</th>
                      <th className="px-5 py-3">Target</th>
                      <th className="px-5 py-3">Sold</th>
                      <th className="px-5 py-3">Result</th>
                      <th className="px-5 py-3 text-right">Cash variance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef4]">
                    {weeklyReportHistory.map(week => (
                      <tr
                        key={week.weekStartDate}
                        className={week.isCurrent ? "bg-[#faf9ff]" : ""}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#2d3040]">
                              {prettyDate(week.weekStartDate)}
                            </span>
                            {week.isCurrent && (
                              <span className="rounded-full bg-[#f0efff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#5b4de1]">
                                Current
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-[#8d90a2]">
                            to {prettyDate(week.weekEndDate)}
                          </p>
                        </td>
                        <td className="px-5 py-4 font-semibold text-[#17182b]">
                          {week.targetUnits === null
                            ? "Not recorded"
                            : `${number(week.targetUnits)} packs/reams`}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#17182b]">
                            {number(week.unitsSold)} packs/reams
                          </p>
                          {week.completionPercent !== null && (
                            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-[#ebeaf4]">
                              <div
                                className="h-full rounded-full bg-[#6d5dfc]"
                                style={{
                                  width: `${Math.min(100, week.completionPercent)}%`,
                                }}
                              />
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {week.targetReached === null ? (
                            <span className="text-[#8d90a2]">
                              No saved goal
                            </span>
                          ) : week.targetReached ? (
                            <span className="font-semibold text-[#5b4de1]">
                              Goal reached •{" "}
                              {number(week.completionPercent ?? 0, 1)}%
                            </span>
                          ) : (
                            <span className="text-[#64687b]">
                              {number(week.unitsRemaining ?? 0)} to go •{" "}
                              {number(week.completionPercent ?? 0, 1)}%
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-5 py-4 text-right font-semibold ${week.cashVarianceCentavos === 0 ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                        >
                          {signedPeso(week.cashVarianceCentavos)}
                          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#8d90a2]">
                            {week.cashVarianceCentavos === 0
                              ? "Balanced"
                              : week.cashVarianceCentavos < 0
                                ? "Short"
                                : "Over"}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {weeklyReportHistory.map(week => (
                  <article
                    key={week.weekStartDate}
                    className={`rounded-xl border p-4 ${week.isCurrent ? "border-[#ded9ff] bg-[#faf9ff]" : "border-[#eeeef4] bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[#17182b]">
                            {prettyDate(week.weekStartDate)}
                          </p>
                          {week.isCurrent && (
                            <span className="rounded-full bg-[#f0efff] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#5b4de1]">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[#8d90a2]">
                          to {prettyDate(week.weekEndDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-semibold ${week.cashVarianceCentavos === 0 ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                        >
                          {signedPeso(week.cashVarianceCentavos)}
                        </p>
                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#8d90a2]">
                          Cash variance
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <LedgerStat
                        label="Weekly target"
                        value={
                          week.targetUnits === null
                            ? "Not recorded"
                            : `${number(week.targetUnits)} packs/reams`
                        }
                      />
                      <LedgerStat
                        label="Sold"
                        value={`${number(week.unitsSold)} packs/reams`}
                        emphasis
                      />
                    </div>
                    {week.completionPercent !== null && (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#ebeaf4]">
                          <div
                            className="h-full rounded-full bg-[#6d5dfc]"
                            style={{
                              width: `${Math.min(100, week.completionPercent)}%`,
                            }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-[#64687b]">
                          {week.targetReached
                            ? `Goal reached • ${number(week.completionPercent, 1)}%`
                            : `${number(week.unitsRemaining ?? 0)} packs/reams to go • ${number(week.completionPercent, 1)}%`}
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <Empty text="Weekly target history will appear after the first saved goal." />
          )}
        </section>
        <section className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#6d5dfc]">
                Cash variance
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
                Expected vs collected
              </h3>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0efff] text-[#6d5dfc]">
              <Calculator className="h-5 w-5" />
            </span>
          </div>
          <p
            className={`mt-5 text-3xl font-semibold ${dashboard.periods.week.cashVarianceCentavos === 0 ? "text-[#17182b]" : "text-[#9d3f35]"}`}
          >
            {signedPeso(dashboard.periods.week.cashVarianceCentavos)}
          </p>
          <p className="mt-1 text-sm text-[#8d90a2]">
            Current Monday-to-today variance
          </p>
          <div className="mt-5 space-y-3">
            {(["week", "month", "quarter", "year"] as const).map(key => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#eeeef4] px-3 py-3"
              >
                <span className="text-sm capitalize text-[#64687b]">
                  This {key}
                </span>
                <span
                  className={`font-semibold ${dashboard.periods[key].cashVarianceCentavos === 0 ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                >
                  {signedPeso(dashboard.periods[key].cashVarianceCentavos)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-[#f7f7fb] p-4 text-xs leading-5 text-[#64687b]">
            <strong className="text-[#2d3040]">How to read it:</strong> A
            negative amount means cash collected was short of expected sales. A
            positive amount means an overage. Immediate-payment sales never
            create customer credit.
          </div>
        </section>
      </div>
      <section className="panel mt-5 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0efff] text-[#6d5dfc]">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[#17182b]">
              Recorded trend foundation
            </h3>
            <p className="text-sm text-[#8d90a2]">
              Weekly target history and Cash variance use actual saved goals and
              ledger totals. No speculative forecast is included.
            </p>
          </div>
        </div>
      </section>
    </>
  );

  const settingsView = (
    <>
      <SectionHeading
        eyebrow="Future defaults"
        title="Product & business settings"
        info="Changing a default does not rewrite history. Existing sales keep their original price and cost; new transactions use the saved defaults."
        copy="New pricing and costs are used only for future transactions. Historical records retain their saved values."
      />
      <div className="grid max-w-5xl gap-5 xl:grid-cols-2">
        <form
          onSubmit={e => {
            e.preventDefault();
            updateSettings.mutate({
              minimumInventoryUnits: Number(settingsForm.min),
              costPerUnitPesos: Number(settingsForm.cost),
              sellingPricePesos: Number(settingsForm.price),
              unitsPerBox: Number(settingsForm.perBox),
              boxCostPesos: Number(settingsForm.boxCost),
              weeklyUnitsTarget: Number(settingsForm.weeklyUnitsTarget),
              monthlyProfitTargetPesos: Number(
                settingsForm.monthlyProfitTarget
              ),
            });
          }}
          className="panel p-5"
        >
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
            Product defaults
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cost per box (₱)</Label>
              <input
                required
                min="0"
                type="number"
                value={settingsForm.boxCost}
                onChange={e =>
                  setSettingsForm({ ...settingsForm, boxCost: e.target.value })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Units per box</Label>
              <input
                required
                min="1"
                type="number"
                value={settingsForm.perBox}
                onChange={e =>
                  setSettingsForm({ ...settingsForm, perBox: e.target.value })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Cost per unit (₱)</Label>
              <input
                required
                min="0"
                type="number"
                value={settingsForm.cost}
                onChange={e =>
                  setSettingsForm({ ...settingsForm, cost: e.target.value })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Selling price per unit (₱)</Label>
              <input
                required
                min="0"
                type="number"
                value={settingsForm.price}
                onChange={e =>
                  setSettingsForm({ ...settingsForm, price: e.target.value })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label>Minimum inventory level</Label>
              <input
                required
                min="0"
                type="number"
                value={settingsForm.min}
                onChange={e =>
                  setSettingsForm({ ...settingsForm, min: e.target.value })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label info="Sets the packs/reams goal for each Monday-to-Sunday sales week. The Sales Rhythm card resets progress every Monday.">
                Weekly packs/reams target
              </Label>
              <input
                required
                min="1"
                step="1"
                inputMode="numeric"
                type="number"
                value={settingsForm.weeklyUnitsTarget}
                onChange={e =>
                  setSettingsForm({
                    ...settingsForm,
                    weeklyUnitsTarget: e.target.value,
                  })
                }
                className="field mt-1"
              />
            </div>
            <div>
              <Label info="The dashboard compares calendar-month net profit after operating expenses against this goal. You can change it at any time without altering historical transactions.">
                Monthly profit target (₱)
              </Label>
              <input
                required
                min="100"
                step="100"
                type="number"
                value={settingsForm.monthlyProfitTarget}
                onChange={e =>
                  setSettingsForm({
                    ...settingsForm,
                    monthlyProfitTarget: e.target.value,
                  })
                }
                className="field mt-1"
              />
            </div>
            <div className="rounded-xl bg-[#f7f7fb] p-3 text-sm text-[#64687b]">
              <span className="block text-[11px] font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
                Per-unit margin
              </span>
              <strong className="mt-1 block text-lg text-[#6d5dfc]">
                {pesoDecimal(
                  Math.round(
                    (Number(settingsForm.price || 0) -
                      Number(settingsForm.cost || 0)) *
                      100
                  )
                )}
              </strong>
            </div>
          </div>
          <button
            disabled={updateSettings.isPending}
            className="btn-primary mt-5"
          >
            Save business settings
          </button>
        </form>
        <section className="panel p-5">
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#8d90a2]">
            Daily profit allocation
          </p>
          <h3 className="mt-1 text-lg font-semibold text-[#17182b]">
            Capital-weighted daily split
          </h3>
          <p className="mt-1 text-sm text-[#8d90a2]">
            Every new daily sale allocates gross profit only between Gale and
            Nikki using their current capital contribution. Historical sale
            allocations remain unchanged, and Nikki’s Dad receives 0% from daily
            sales.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-[#f0efff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#6d5dfc]">
                Gale
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#17182b]">
                {(
                  (profitLedger.ownerSummaries.find(
                    (owner: any) => owner.name === "Gale"
                  )?.currentProfitShareBasisPoints ?? 0) / 100
                ).toFixed(2)}
                %
              </p>
            </div>
            <div className="rounded-xl bg-[#f0efff] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#6d5dfc]">
                Nikki
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#17182b]">
                {(
                  (profitLedger.ownerSummaries.find(
                    (owner: any) => owner.name === "Nikki"
                  )?.currentProfitShareBasisPoints ?? 0) / 100
                ).toFixed(2)}
                %
              </p>
            </div>
            <div className="rounded-xl bg-[#f7f7fb] p-4">
              <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#8d90a2]">
                Nikki’s Dad
              </p>
              <p className="mt-2 text-2xl font-semibold text-[#64687b]">
                0.00%
              </p>
            </div>
          </div>
          <p className="mt-4 rounded-lg bg-[#f7f7fb] p-3 text-sm text-[#64687b]">
            The ratio updates for future sales when capital changes. Each sale
            stores the ratio used at the time it was recorded, so historical
            allocations do not move.
          </p>
        </section>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="panel p-4">
          <ShieldCheck className="h-5 w-5 text-[#6d5dfc]" />
          <h3 className="mt-3 font-semibold text-[#17182b]">Open by link</h3>
          <p className="mt-1 text-sm text-[#8d90a2]">
            Anyone with this link can review and update the live business
            ledger.
          </p>
        </div>
        <div className="panel p-4">
          <ReceiptText className="h-5 w-5 text-[#6d5dfc]" />
          <h3 className="mt-3 font-semibold text-[#17182b]">Audit trail</h3>
          <p className="mt-1 text-sm text-[#8d90a2]">
            Sales, payments, expenses, capital entries, settings updates, and
            closes are logged.
          </p>
        </div>
        <div className="panel p-4">
          <X className="h-5 w-5 text-[#6d5dfc]" />
          <h3 className="mt-3 font-semibold text-[#17182b]">
            No silent deletion
          </h3>
          <p className="mt-1 text-sm text-[#8d90a2]">
            V1 is designed around retained transactions and future reversals
            rather than accidental deletion.
          </p>
        </div>
      </div>
    </>
  );

  const views: Record<View, React.ReactNode> = {
    dashboard: dashboardView,
    sales: salesView,
    inventory: inventoryView,
    money: moneyView,
    reports: reportsView,
    data: dataView,
    settings: settingsView,
  };
  return (
    <div className="app-shell">
      <div className="hidden min-h-screen lg:flex">
        {sidebar}
        <main className="app-workspace min-w-0 flex-1">
          <header className="app-topbar sticky top-0 z-20 flex h-[72px] items-center justify-between px-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#aaaabd]">
                Workspace
              </p>
              <p className="mt-0.5 text-base font-semibold text-[#17182b]">
                {nav.find(item => item.key === view)?.label}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                title={
                  theme === "light" ? "Turn on dark mode" : "Turn off dark mode"
                }
                className="grid h-10 w-10 place-items-center rounded-xl border border-[#e8e9f1] bg-white text-[#6f7284] transition hover:bg-[#f7f7fb]"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </button>
              <AlertCenter
                alerts={businessAlerts}
                onOpenReports={() => handleNav("reports")}
              />
              <HeaderUser
                authenticated={isAuthenticated}
                name={user?.name}
                onLogout={logout}
                onLock={() => void lockAccess.mutate()}
              />
            </div>
          </header>
          <div className="mx-auto max-w-[1420px] p-6 xl:p-8 2xl:p-10">
            {views[view]}
          </div>
        </main>
      </div>
      <div className="lg:hidden">
        <header className="app-topbar sticky top-0 z-30 flex h-[66px] items-center justify-between px-4">
          <button
            onClick={() => setMobileNav(true)}
            className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f7] text-[#4f5267]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <BrandLogo
              alt="Buy & Sell logo"
              className="h-8 w-8 rounded-lg object-contain"
            />
            <span className="text-sm font-bold text-[#17182b]">Buy & Sell</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertCenter
              alerts={businessAlerts}
              onOpenReports={() => handleNav("reports")}
            />
            <button
              onClick={toggleTheme}
              title={
                theme === "light" ? "Turn on dark mode" : "Turn off dark mode"
              }
              className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1f2f7] text-[#4f5267]"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>
        {mobileNav && (
          <div
            className="fixed inset-0 z-50 bg-[#25213d]/25 backdrop-blur-sm"
            onClick={() => setMobileNav(false)}
          >
            <div
              className="h-full w-[280px]"
              onClick={event => event.stopPropagation()}
            >
              {sidebar}
            </div>
          </div>
        )}
        <main className="p-4 pb-8">{views[view]}</main>
      </div>
      <RestorePreviewDialog
        open={restorePreviewId !== null}
        preview={restorePreview}
        loading={restorePreviewQuery.isFetching}
        error={restorePreviewQuery.error}
        onClose={() => setRestorePreviewId(null)}
      />
    </div>
  );
}

function RestorePreviewDialog({
  open,
  preview,
  loading,
  error,
  onClose,
}: {
  open: boolean;
  preview: any;
  loading: boolean;
  error: { message?: string } | null;
  onClose: () => void;
}) {
  const dateCoverage =
    preview?.summary?.earliestBusinessDate &&
    preview?.summary?.latestBusinessDate
      ? `${prettyDate(preview.summary.earliestBusinessDate)} to ${prettyDate(preview.summary.latestBusinessDate)}`
      : "No dated records";
  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[#e8e9f1] bg-white text-[#17182b] sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0efff] text-[#6d5dfc]">
              <DatabaseBackup className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl text-[#17182b]">
                Restore preview
              </DialogTitle>
              <DialogDescription className="mt-1 text-[#8d90a2]">
                Read-only inspection of the archived data registry. Opening this
                preview never imports or changes live records.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {loading && (
          <div className="space-y-3 py-6">
            <div className="h-20 animate-pulse rounded-xl bg-[#f1f2f7]" />
            <div className="h-40 animate-pulse rounded-xl bg-[#f7f7fb]" />
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-[#f5d4d0] bg-[#fff1ef] p-4 text-sm text-[#9d3f35]">
            <strong>Preview unavailable.</strong>{" "}
            {error.message ?? "The archive could not be inspected."}
          </div>
        )}
        {preview && !loading && (
          <>
            <div
              className={`rounded-xl border p-4 ${preview.readyForImport ? "border-[#d9d5ff] bg-[#f0efff]" : "border-[#f5d4d0] bg-[#fff1ef]"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    className={`text-xs font-bold uppercase tracking-[.14em] ${preview.readyForImport ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                  >
                    {preview.readyForImport
                      ? "Validation passed"
                      : "Review required"}
                  </p>
                  <h3 className="mt-1 font-mono text-sm font-semibold text-[#17182b]">
                    {preview.backup.recordCode}
                  </h3>
                  <p className="mt-1 text-xs text-[#8d90a2]">
                    {preview.backup.backupType} backup ·{" "}
                    {prettyDate(preview.backup.createdAt)} · format v
                    {preview.manifest.version ?? "unknown"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${preview.checksumValid ? "bg-white text-[#5b4de1]" : "bg-white text-[#9d3f35]"}`}
                >
                  {preview.checksumValid
                    ? "Checksum verified"
                    : "Checksum mismatch"}
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <LedgerStat
                label="Archived records"
                value={number(preview.summary.totalActualRecords)}
                emphasis
              />
              <LedgerStat
                label="Live registry records"
                value={number(preview.summary.currentRegistryRecords)}
              />
              <LedgerStat
                label="Registry tables"
                value={number(preview.summary.tableCount)}
              />
              <LedgerStat label="Date coverage" value={dateCoverage} />
            </div>
            {preview.warnings?.length > 0 && (
              <div className="rounded-xl border border-[#f5d4d0] bg-[#fff1ef] p-4">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9d3f35]">
                  Validation warnings
                </p>
                <ul className="mt-2 space-y-1 text-sm text-[#8f2d24]">
                  {preview.warnings.map((warning: string) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="overflow-hidden rounded-xl border border-[#e8e9f1]">
              <div className="border-b border-[#eeeef4] bg-[#f7f7fb] px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8d90a2]">
                  Archived table summary
                </p>
                <p className="mt-1 text-xs text-[#9699aa]">
                  Backup counts are compared with the current live data
                  registry. A difference is informational; manifest mismatches
                  block readiness.
                </p>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="sticky top-0 bg-white text-[10px] font-bold uppercase tracking-[.1em] text-[#8d90a2]">
                    <tr>
                      <th className="px-4 py-2.5">Table</th>
                      <th className="px-4 py-2.5 text-right">Backup</th>
                      <th className="px-4 py-2.5 text-right">Live</th>
                      <th className="px-4 py-2.5 text-right">Difference</th>
                      <th className="px-4 py-2.5 text-right">Manifest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eeeef4]">
                    {preview.tables.map((table: any) => (
                      <tr key={table.table}>
                        <td className="px-4 py-2.5 font-medium capitalize text-[#2d3040]">
                          {String(table.table).replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-[#17182b]">
                          {number(table.actualRows)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[#64687b]">
                          {number(table.currentRows)}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-medium ${table.rowDifference === 0 ? "text-[#8d90a2]" : table.rowDifference > 0 ? "text-[#5b4de1]" : "text-[#9d3f35]"}`}
                        >
                          {table.rowDifference > 0 ? "+" : ""}
                          {number(table.rowDifference)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${table.matchesManifest ? "bg-[#f0efff] text-[#5b4de1]" : "bg-[#fff1ef] text-[#9d3f35]"}`}
                          >
                            {table.matchesManifest ? "Match" : "Mismatch"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border border-[#e8e9f1] bg-[#f0efff] p-4 text-sm text-[#3f347e]">
              <strong className="text-[#3f347e]">
                No import has been performed.
              </strong>{" "}
              This workflow only validates and summarizes the archive. A
              production import must remain a separate, explicitly confirmed
              operation after reviewing these results.
            </div>
          </>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <button type="button" className="btn-secondary">
              Close preview
            </button>
          </DialogClose>
          {preview?.backup?.id && (
            <a
              href={`/api/backups/${preview.backup.id}/download`}
              download={`${preview.backup.recordCode}.zip`}
              className="btn-primary"
            >
              <Download className="h-4 w-4" />
              Download verified ZIP
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PublicAccessScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const unlock = trpc.access.unlock.useMutation({
    onSuccess: () => {
      setError("");
      toast.success("Access granted.");
      onUnlocked();
    },
    onError: error => setError(error.message),
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6 text-[#17182b]">
      <div className="w-full max-w-sm rounded-3xl border border-[#e8e9f1] bg-white p-8 text-center shadow-[0_18px_45px_rgba(34,32,73,.10)]">
        <BrandLogo
          alt="Buy & Sell logo"
          className="mx-auto h-20 w-20 rounded-3xl object-contain"
        />
        <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#6d5dfc]">
          Buy & Sell Manager
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Enter access PIN</h1>
        <p className="mt-2 text-sm leading-6 text-[#8d90a2]">
          This business ledger is available to authorized visitors with the
          shared access PIN.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={event => {
            event.preventDefault();
            setError("");
            unlock.mutate({ pin });
          }}
        >
          <input
            autoFocus
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            type="password"
            value={pin}
            onChange={event => setPin(event.target.value.replace(/\D/g, ""))}
            placeholder="4-digit PIN"
            aria-label="Access PIN"
            className="h-12 w-full rounded-xl border border-[#e8e9f1] bg-[#fafaff] px-4 text-center text-lg tracking-[.45em] outline-none transition focus:border-[#6d5dfc] focus:ring-4 focus:ring-[#6d5dfc]/10"
          />
          <button
            type="submit"
            disabled={unlock.isPending || pin.length !== 4}
            className="btn-primary w-full justify-center"
          >
            {unlock.isPending ? "Checking..." : "Open business ledger"}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-[#9d3f35]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f7fb] px-6 text-[#17182b]">
      <div className="flex w-full max-w-xs flex-col items-center text-center">
        <BrandLogo
          alt="Buy & Sell logo"
          className="h-24 w-24 animate-pulse rounded-3xl object-contain shadow-[0_10px_30px_rgba(10,37,64,.08)]"
        />
        <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#6d5dfc]">
          Buy & Sell Manager
        </p>
        <h1 className="mt-2 text-xl font-semibold">
          Loading your business ledger
        </h1>
        <p className="mt-2 text-sm text-[#8d90a2]">
          Preparing sales, inventory, and reconciliation data.
        </p>
        <div className="mt-6 h-1.5 w-32 overflow-hidden rounded-full bg-[#e8e9f1]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-[#6d5dfc]" />
        </div>
      </div>
    </div>
  );
}

function HeaderUser({
  authenticated,
  name,
  onLogout,
  onLock,
}: {
  authenticated: boolean;
  name?: string | null;
  onLogout: () => void;
  onLock: () => void;
}) {
  return authenticated ? (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-semibold text-[#2d3040]">
          {name || "Owner"}
        </p>
        <p className="text-[11px] text-[#8d90a2]">Optional secure session</p>
      </div>
      <button
        onClick={onLogout}
        className="rounded-lg border border-[#e8e9f1] px-3 py-2 text-xs font-semibold text-[#64687b] hover:bg-[#f7f7fb]"
      >
        Sign out
      </button>
    </div>
  ) : (
    <button
      onClick={onLock}
      className="rounded-lg border border-[#e8e9f1] bg-white px-3 py-2 text-xs font-semibold text-[#64687b] hover:bg-[#f7f7fb]"
    >
      Lock PIN access
    </button>
  );
}
function LedgerStat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={
        emphasis ? "rounded-xl bg-[#f0efff] p-3" : "rounded-xl bg-[#f7f7fb] p-3"
      }
    >
      <p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#8d90a2]">
        {label}
      </p>
      <p
        className={`mt-1 text-sm font-semibold ${emphasis ? "text-[#5b4de1]" : "text-[#2d3040]"}`}
      >
        {value}
      </p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-[#8d90a2]">{text}</div>;
}
function SalesTable({ items }: { items: any[] }) {
  return items.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="bg-[#f7f7fb] text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
          <tr>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Units</th>
            <th className="px-5 py-3">Revenue</th>
            <th className="px-5 py-3">Gross profit</th>
            <th className="px-5 py-3">Cash collected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef4]">
          {items.map(item => (
            <tr key={item.id}>
              <td className="px-5 py-3 font-medium text-[#64687b]">
                {prettyDate(item.saleDate)}
              </td>
              <td className="px-5 py-3">{item.unitsSold}</td>
              <td className="px-5 py-3">
                {peso(item.expectedRevenueCentavos)}
              </td>
              <td className="px-5 py-3 font-medium text-[#6d5dfc]">
                {peso(item.grossProfitCentavos)}
              </td>
              <td className="px-5 py-3 text-[#64687b]">
                {peso(item.cashCollectedCentavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No sales yet. Use the fast daily entry above to create your first transaction." />
  );
}

function TransitionTable({ rows }: { rows: Record<string, any> }) {
  const metrics: Array<{ label: string; key: string; format?: "peso" }> = [
    { label: "Starting boxes", key: "startingBoxes" },
    {
      label: "Starting capital",
      key: "startingCapitalCentavos",
      format: "peso",
    },
    { label: "Starting units", key: "startingUnits" },
    { label: "Units sold", key: "unitsSold" },
    { label: "Revenue", key: "revenueCentavos", format: "peso" },
    { label: "COGS", key: "cogsCentavos", format: "peso" },
    {
      label: "Actual gross profit",
      key: "grossProfitCentavos",
      format: "peso",
    },
    { label: "Cash collected", key: "cashCollectedCentavos", format: "peso" },
    {
      label: "Capital withdrawn",
      key: "capitalWithdrawnCentavos",
      format: "peso",
    },
    {
      label: "Profit distributed",
      key: "profitDistributedCentavos",
      format: "peso",
    },
    { label: "Remaining inventory", key: "remainingInventoryUnits" },
  ];
  const format = (value: number, kind?: "peso") =>
    kind === "peso" ? peso(value) : number(value);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#f7f7fb] text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
          <tr>
            <th className="px-5 py-3">Metric</th>
            <th className="px-5 py-3">Gale</th>
            <th className="px-5 py-3">Nikki</th>
            <th className="px-5 py-3">Combined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef4]">
          {metrics.map(metric => (
            <tr
              key={metric.key}
              className={
                metric.key === "grossProfitCentavos" ||
                metric.key === "remainingInventoryUnits"
                  ? "bg-[#fafbff]"
                  : ""
              }
            >
              <td className="px-5 py-3 font-medium text-[#64687b]">
                {metric.label}
              </td>
              <td className="px-5 py-3 text-[#2d3040]">
                {format(rows.gale[metric.key], metric.format)}
              </td>
              <td className="px-5 py-3 text-[#2d3040]">
                {format(rows.nikki[metric.key], metric.format)}
              </td>
              <td
                className={`px-5 py-3 font-semibold ${metric.key === "grossProfitCentavos" ? "text-[#6d5dfc]" : "text-[#17182b]"}`}
              >
                {format(rows.combined[metric.key], metric.format)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DataSalesTable({
  items,
  onVoid,
  canVoid,
}: {
  items: any[];
  onVoid: (item: any) => void;
  canVoid: boolean;
}) {
  return items.length ? (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="bg-[#f7f7fb] text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
          <tr>
            <th className="px-5 py-3">Transaction</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3">Units</th>
            <th className="px-5 py-3">Revenue</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3 text-right">Control</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef4]">
          {items.map(item => (
            <tr
              key={item.id}
              className={item.isVoided ? "bg-[#f7f7fb]/80 text-[#9699aa]" : ""}
            >
              <td className="px-5 py-3 font-mono text-xs font-semibold text-[#64687b]">
                {item.recordCode ?? `SALE-${item.id}`}
              </td>
              <td className="px-5 py-3">{prettyDate(item.saleDate)}</td>
              <td className="px-5 py-3">{item.unitsSold}</td>
              <td className="px-5 py-3">
                {peso(item.expectedRevenueCentavos)}
              </td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${item.isVoided ? "bg-[#ecebf4] text-[#64687b]" : "bg-[#f0efff] text-[#5b4de1]"}`}
                >
                  {item.isVoided ? "voided" : "active"}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                {!item.isVoided && (
                  <button
                    disabled={!canVoid}
                    onClick={() => onVoid(item)}
                    className="text-xs font-semibold text-[#9d3f35] underline disabled:opacity-40"
                  >
                    Void & reverse
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No sales match this filter." />
  );
}

function ProfitSplitTable({ entries }: { entries: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[#f7f7fb] text-[10px] font-bold uppercase tracking-[.12em] text-[#8d90a2]">
          <tr>
            <th className="px-5 py-3">Owner</th>
            <th className="px-5 py-3">Profit share</th>
            <th className="px-5 py-3 text-right">Earned from sale</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eeeef4]">
          {entries.map(entry => (
            <tr key={entry.ownerId}>
              <td className="px-5 py-3 font-semibold text-[#2d3040]">
                {entry.ownerName}
              </td>
              <td className="px-5 py-3 text-[#8d90a2]">
                {(entry.shareBasisPoints / 100).toFixed(2)}%
              </td>
              <td className="px-5 py-3 text-right font-semibold text-[#5b4de1]">
                {peso(entry.amountCentavos)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
