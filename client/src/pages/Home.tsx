import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { summarizeSales } from "@shared/ledger";
import {
  Archive,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Boxes,
  CalendarCheck,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CloudDownload,
  CreditCard,
  Database,
  DollarSign,
  FileBarChart,
  FileBox,
  History,
  LayoutDashboard,
  LifeBuoy,
  Menu,
  Moon,
  Package,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Sun,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Sale = { id: number; date: string; item: string; packs: number; revenue: number; profit: number };

const initialSales: Sale[] = [
  { id: 1, date: "Today", item: "Repacked essentials", packs: 0, revenue: 0, profit: 0 },
  { id: 2, date: "Yesterday", item: "Household bundle", packs: 12, revenue: 1380, profit: 420 },
  { id: 3, date: "Monday", item: "Weekend market stock", packs: 26, revenue: 2860, profit: 920 },
];

const navGroups = [
  { label: "Overview", items: [{ label: "Dashboard", icon: LayoutDashboard }] },
  { label: "Operations", items: [{ label: "Sales", icon: ShoppingBag }, { label: "Inventory", icon: Package }, { label: "Money", icon: WalletCards }, { label: "Initial cycle", icon: CalendarCheck }] },
  { label: "Analytics", items: [{ label: "Reports", icon: BarChart3 }] },
  { label: "System", items: [{ label: "Data & Backups", icon: Database }, { label: "Settings", icon: Settings }] },
];

function money(value: number) {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function Home() {
  const [active, setActive] = useState("Dashboard");
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [sales, setSales] = useState(initialSales);
  const [search, setSearch] = useState("");
  const [saleForm, setSaleForm] = useState({ item: "", packs: "", revenue: "", profit: "" });

  const totals = useMemo(() => summarizeSales(sales), [sales]);

  function choose(label: string) {
    setActive(label);
    setSidebarOpen(false);
    if (label !== "Dashboard") toast(`${label} workspace selected`, { description: "This rebuild keeps the navigation ready for the next workflow." });
  }

  function addSale(event: FormEvent) {
    event.preventDefault();
    const next: Sale = { id: Date.now(), date: "Today", item: saleForm.item || "New sale", packs: Number(saleForm.packs) || 0, revenue: Number(saleForm.revenue) || 0, profit: Number(saleForm.profit) || 0 };
    setSales((current) => [next, ...current]);
    setSaleForm({ item: "", packs: "", revenue: "", profit: "" });
    setShowSale(false);
    toast.success("Daily sale added", { description: `${next.item} is now included in today's ledger.` });
  }

  const filteredSales = sales.filter((sale) => sale.item.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={dark ? "app-shell dark-mode" : "app-shell"}>
      <aside className={sidebarOpen ? "sidebar sidebar-open" : "sidebar"}>
        <div className="brand-row"><div className="brand-mark"><Boxes size={21} /></div><div><strong>Buy & Sell</strong><span>BUSINESS MANAGER</span></div><button className="mobile-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
        <div className="sidebar-scroll">
          {navGroups.map((group) => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(({ label, icon: Icon }) => <button className={active === label ? "nav-item active" : "nav-item"} key={label} onClick={() => choose(label)}><Icon size={16} /><span>{label}</span>{label === "Data & Backups" && <span className="nav-badge">2</span>}</button>)}</div>)}
        </div>
        <div className="protected-card"><div className="protected-icon"><Archive size={15} /></div><div><strong>Protected history</strong><p>Corrections are logged and restore previews never change your ledger.</p></div></div>
        <button className="signin" onClick={() => toast("Sign in is ready", { description: "Connect your account when authentication is enabled." })}><LifeBuoy size={16} /> Sign in</button>
      </aside>

      <main className="main-area">
        <header className="topbar"><button className="menu-button" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div><span className="eyebrow">WORKSPACE</span><div className="crumb">{active}</div></div><div className="top-actions"><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Toggle dark mode">{dark ? <Sun size={17} /> : <Moon size={17} />}</button><button className="icon-button" onClick={() => toast("You are all caught up", { description: "No active alerts in this workspace." })}><Bell size={17} /></button><span className="access-pill">Public link access</span></div></header>
          <div className="content">
            <div className="page-heading"><div><span className="eyebrow purple">DASHBOARD</span><h1>Good morning, team <span className="sparkle">✦</span></h1><p>Monday, September 28, 2026 · Shared business ledger</p></div><div className="quick-actions"><button className="primary-button" onClick={() => setShowSale(true)}><Plus size={16} /> Add daily sale</button><button className="secondary-button" onClick={() => setShowClose(true)}><CalendarCheck size={15} /> Close day</button><button className="secondary-button" onClick={() => toast("Last close reopened", { description: "The previous close is available for review." })}><RotateCcw size={15} /> Reopen last close</button></div></div>

            <section className="metric-grid three"><Metric label="TODAY'S SALES" value={money(sales[0]?.revenue ?? 0)} hint={`${sales[0]?.packs ?? 0} units sold`} icon={CreditCard} /><Metric label="TODAY'S PROFIT" value={money(sales[0]?.profit ?? 0)} hint="Gross profit before expenses" icon={DollarSign} /><Metric label="INVENTORY" value="143 units" hint="2.86 boxes · ₱100,100 tied up" icon={Package} /></section>
            <section className="metric-grid three lower"><Metric label="RETAINED CASH AVAILABLE" value="₱123,610" hint="Click to view cash-flow breakdown" icon={WalletCards} highlight onClick={() => toast("Cash-flow breakdown", { description: "Available cash is reconciled from closed days and current sales." })} /><Metric label="WEEKLY TARGET" value="0 of 500" hint="50 packs/rims to go" icon={BarChart3} progress={0} /><Metric label="MONTHLY PROFIT GOAL" value="₱11,290 to go" hint="₱13,710 earned of ₱25,000" icon={CircleHelp} progress={55} /></section>

            <section className="dashboard-grid"><div className="panel chart-panel"><div className="panel-header"><div><span className="eyebrow">REVENUE OVERVIEW</span><h2>Sales rhythm</h2><p>Monday to Sunday · current week</p></div><select aria-label="Sales rhythm period"><option>Weekly</option><option>Monthly</option><option>Custom</option></select></div><div className="chart-stats"><div><span>Revenue</span><strong>{money(totals.revenue)}</strong></div><div><span>Gross profit</span><strong>{money(totals.profit)}</strong></div><div><span>Total packs/rims sold</span><strong>{totals.packs} packs/rims</strong><small>Last week: 457 · 457 fewer than last week · 100% lower</small></div><div><span>Best day</span><strong>{totals.packs ? "Monday" : "0 units"}</strong></div></div><div className="chart"><div className="grid-line l1"><span>4</span></div><div className="grid-line l2"><span>3</span></div><div className="grid-line l3"><span>2</span></div><div className="grid-line l4"><span>1</span></div><div className="grid-line l5"><span>0</span></div><div className="chart-line"><i></i></div><div className="days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div></div></div><div className="panel health-panel"><div className="panel-header"><div><span className="eyebrow">BUSINESS HEALTH</span><h2>At a glance</h2></div><div className="health-ring"><Sparkles size={16} /></div></div><div className="health-item"><span>Sales velocity</span><strong>15.2 units/day</strong></div><div className="health-item"><span>Days until stockout</span><strong>9.4 days</strong></div><div className="health-item"><span>Collection mode</span><strong className="purple-text">Immediate payment</strong></div><div className="health-total"><span>Net profit this month</span><strong>₱13,710</strong></div></div></section>

            <section className="panel activity-panel"><div className="panel-header"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Ledger entries</h2></div><div className="table-actions"><div className="search-box"><Search size={15} /><input placeholder="Search entries" value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="secondary-button" onClick={() => toast("Export queued", { description: "A CSV export will be ready in Data & Backups." })}><CloudDownload size={15} /> Export</button></div></div><div className="table-wrap"><table><thead><tr><th>Entry</th><th>Date</th><th>Packs / rims</th><th>Revenue</th><th>Profit</th><th></th></tr></thead><tbody>{filteredSales.map((sale) => <tr key={sale.id}><td><div className="entry-title"><div className="entry-icon"><FileBox size={15} /></div><strong>{sale.item}</strong></div></td><td>{sale.date}</td><td>{sale.packs}</td><td>{money(sale.revenue)}</td><td className="profit-cell">{money(sale.profit)}</td><td><button className="row-more" onClick={() => toast("Entry options", { description: "Edit and audit tools are ready for this ledger row." })}>•••</button></td></tr>)}</tbody></table></div></section>
          </div>
      </main>

      {showSale && <Modal title="Add daily sale" onClose={() => setShowSale(false)}><form onSubmit={addSale} className="modal-form"><label>Item or bundle<input autoFocus value={saleForm.item} onChange={(e) => setSaleForm({ ...saleForm, item: e.target.value })} placeholder="e.g. Household bundle" /></label><div className="form-row"><label>Packs / rims<input type="number" min="0" value={saleForm.packs} onChange={(e) => setSaleForm({ ...saleForm, packs: e.target.value })} /></label><label>Revenue (₱)<input type="number" min="0" value={saleForm.revenue} onChange={(e) => setSaleForm({ ...saleForm, revenue: e.target.value })} /></label></div><label>Gross profit (₱)<input type="number" min="0" value={saleForm.profit} onChange={(e) => setSaleForm({ ...saleForm, profit: e.target.value })} /></label><button className="primary-button full" type="submit">Save sale</button></form></Modal>}
      {showClose && <Modal title="Close the day" onClose={() => setShowClose(false)}><div className="close-copy"><div className="close-icon"><ClipboardList size={24} /></div><h3>Ready to reconcile?</h3><p>Closing the day locks today's sales snapshot and starts a protected audit trail. You can reopen the last close if something needs correction.</p><button className="primary-button full" onClick={() => { setShowClose(false); toast.success("Day closed", { description: "Today's ledger snapshot has been protected." }); }}>Confirm close</button></div></Modal>}
    </div>
  );
}

function Metric({ label, value, hint, icon: Icon, progress, highlight, onClick }: { label: string; value: string; hint: string; icon: typeof DollarSign; progress?: number; highlight?: boolean; onClick?: () => void }) {
  return <button className={highlight ? "metric-card highlight" : "metric-card"} onClick={onClick}><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{hint}</small>{progress !== undefined && <><div className="progress"><i style={{ width: `${progress}%` }} /></div><div className="progress-label">{progress}% COMPLETE</div></>}</button>;
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={17} /></button></div>{children}</div></div>;
}
