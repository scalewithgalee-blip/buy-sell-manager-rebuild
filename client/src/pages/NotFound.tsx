import { EMBEDDED_APP_LOGO } from "@/lib/brandAsset";
import { ArrowLeft, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-5 py-12">
      <section className="panel w-full max-w-lg overflow-hidden p-7 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#e8e9f1] bg-white shadow-[0_10px_30px_rgba(109,93,252,.1)]">
          <img src={EMBEDDED_APP_LOGO} alt="Buy & Sell logo" className="h-11 w-11 object-contain" />
        </div>
        <p className="mt-7 text-[11px] font-bold uppercase tracking-[.18em] text-[#6d5dfc]">Page not found</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#17182b]">We could not find that page.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#777b91]">
          The link may be outdated. Return to the shared business workspace to continue.
        </p>
        <button type="button" onClick={() => setLocation("/")} className="btn-primary mt-7">
          <Home className="h-4 w-4" />
          Return to dashboard
          <ArrowLeft className="h-4 w-4" />
        </button>
      </section>
    </main>
  );
}
