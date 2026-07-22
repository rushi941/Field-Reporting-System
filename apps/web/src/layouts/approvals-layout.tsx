import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, History, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ActivityDot } from "@/components/activity-dot";
import { usePendingApprovalActivity } from "@/hooks/use-pending-approval-activity";

const navItems = [
  { to: "/approvals", end: true, label: "Pending queue", icon: ClipboardCheck, badge: true },
  { to: "/approvals/history", end: false, label: "Project history", icon: History, badge: false },
];

export function ApprovalsLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount, pendingCount } = usePendingApprovalActivity(
    can("reports.view_pending_queue") ? user?.id : undefined,
  );

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
            Div. Manager
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const showBadge = item.badge && unreadCount > 0;
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
                  <span className="relative shrink-0">
                    <Icon
                      className={cn(
                        "size-4",
                        isActive ? "text-lane" : "text-steel",
                      )}
                    />
                    {showBadge && (
                      <ActivityDot className="-right-0.5 -top-0.5 ring-sidebar" />
                    )}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {showBadge && pendingCount > 0 && (
                    <span className="text-[10px] tabular-nums text-steel">
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
    <div className="flex min-h-svh overflow-x-hidden bg-background">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Dismiss menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-50 h-full w-72 max-w-[min(18rem,85vw)] shadow-xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-50 flex shrink-0 items-center gap-2 border-b border-border bg-card/95 px-3 py-2.5 backdrop-blur pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <button
            type="button"
            className="relative shrink-0 rounded-md p-2 hover:bg-muted"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            {!mobileOpen && unreadCount > 0 && (
              <ActivityDot className="-right-0.5 -top-0.5" />
            )}
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">Approvals</p>
          {pendingCount > 0 && (
            <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-red-800">
              {pendingCount} pending
            </span>
          )}
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-5">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
