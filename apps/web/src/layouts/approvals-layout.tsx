import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, History, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/approvals", end: true, label: "Pending queue", icon: ClipboardCheck },
  { to: "/approvals/history", end: false, label: "Project history", icon: History },
];

export function ApprovalsLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!can("reports.view_pending_queue")) return;
    void (async () => {
      try {
        const s = await apiFetch<{
          pendingCount: number;
        }>("/api/v1/approvals/summary");
        setPendingCount(s.pendingCount);
      } catch {
        /* non-blocking */
      }
    })();
  }, [can]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Signed out successfully");
      navigate("/login", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logout failed");
    } finally {
      setLoggingOut(false);
    }
  }

  const sidebar = (
    <aside className="flex h-full w-72 flex-col bg-sidebar text-slate-200">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex size-9 items-center justify-center rounded bg-lane font-display text-sm font-bold text-asphalt">
          AT
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            Advance Traffic
          </p>
          <p className="truncate text-[11px] font-medium text-steel">
            Division Manager
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const showBadge = item.to === "/approvals" && pendingCount > 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-muted text-white shadow-sm ring-1 ring-lane/40"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-lane" : "text-steel",
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="rounded-full bg-lane px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-asphalt">
                      {pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate px-1 text-xs text-slate-300">
          {user?.firstName} {user?.lastName}
        </p>
        <Button
          variant="ghost"
          className="mt-2 w-full justify-start gap-2 text-slate-300 hover:bg-white/5 hover:text-white"
          disabled={loggingOut}
          onClick={() => void handleLogout()}
        >
          <LogOut className="size-4" />
          {loggingOut ? "Signing out…" : "Log out"}
        </Button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-svh bg-background">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 h-full w-72 shadow-xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 lg:hidden">
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <p className="text-sm font-semibold">Approvals</p>
          {pendingCount > 0 && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900">
              {pendingCount} pending
            </span>
          )}
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
