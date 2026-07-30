import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppBootScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background">
      <div className="flex size-10 items-center justify-center rounded-lg bg-lane font-display text-sm font-bold text-asphalt">
        AT
      </div>
      <Loader2 className="size-5 animate-spin text-sky-800" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}

function DelayedFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 120);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) {
    return <div className="min-h-[12rem]" aria-hidden />;
  }

  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-sky-800" />
      Loading page…
    </div>
  );
}

export function PageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<DelayedFallback />}>{children}</Suspense>;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="page-enter">
      {children}
    </div>
  );
}

export function ListPageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-hidden>
      <div className="h-4 w-2/3 rounded bg-muted" />
      <div className="h-11 rounded-lg bg-muted" />
      <div className="space-y-2.5 pt-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-[4.5rem] rounded-xl bg-muted/80" />
        ))}
      </div>
    </div>
  );
}

export function RefreshBar({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "h-0.5 overflow-hidden rounded-full bg-sky-100 transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    >
      <div className="refresh-bar h-full w-1/3 rounded-full bg-sky-600" />
    </div>
  );
}
