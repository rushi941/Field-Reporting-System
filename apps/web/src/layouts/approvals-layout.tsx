import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, History, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ActivityDot } from "@/components/activity-dot";
import { PageSuspense, PageTransition } from "@/components/page-shell";
import { prefetchRoute } from "@/lib/route-prefetch";
import { usePendingApprovalActivity } from "@/hooks/use-pending-approval-activity";
import { resolveActiveNavTo } from "@/lib/nav-active";
import { UserHeaderIdentity } from "@/components/user-role-pill";
import { BrandLogo, SidebarBrand } from "@/components/brand-logo";

const navItems = [
  {
    to: "/approvals",
    end: true,
    label: "Pending queue",
    mobileLabel: "Pending",
    icon: ClipboardCheck,
    badge: true,
  },
  {
    to: "/approvals/history",
    end: true,
    label: "Project history",
    mobileLabel: "History",
    icon: History,
    badge: false,
  },
] as const;

function isApprovalsListPage(pathname: string) {
  return pathname === "/approvals" || pathname === "/approvals/history";
}

export function ApprovalsLayout() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const showBottomNav = isApprovalsListPage(location.pathname);
  const activeNavTo = resolveActiveNavTo(navItems, location.pathname);
  const { unreadCount } = usePendingApprovalActivity(
    can("reports.view_pending_queue") ? user?.id : undefined,
  );
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const workspaceRole = "DIVISION_MANAGER" as const;

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
      <div className="border-b border-white/10 px-4 py-4">
        <SidebarBrand roleLabel="Division Manager" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const showBadge = item.badge && unreadCount > 0;
          const active = item.to === activeNavTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              onMouseEnter={() => prefetchRoute(item.to)}
              onFocus={() => prefetchRoute(item.to)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-muted text-white shadow-sm ring-1 ring-lane/40"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <span className="relative shrink-0">
                <Icon
                  className={cn("size-4", active ? "text-lane" : "text-steel")}
                />
                {showBadge && (
                  <ActivityDot className="-right-0.5 -top-0.5 ring-sidebar" />
                )}
              </span>
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <p className="truncate px-1 text-xs text-slate-300">{userName}</p>
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
    <div className="flex min-h-svh overflow-x-hidden bg-background lg:h-svh lg:overflow-hidden">
      <div className="hidden h-full shrink-0 bg-sidebar lg:block">
        {sidebar}
      </div>

      <div className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:h-14 lg:gap-3 lg:bg-card/95 lg:px-4 lg:pt-0">
          <div className="flex min-w-0 items-center gap-2">
            <BrandLogo
              variant="compact"
              className="min-w-0 shrink lg:hidden"
              imgClassName="h-7 max-w-[6.5rem] sm:max-w-[13rem]"
            />
            <p className="hidden truncate text-sm font-semibold text-foreground lg:block">
              Field Reporting System
            </p>
          </div>

          <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
            {userName ? (
              <UserHeaderIdentity name={userName} role={workspaceRole} compact />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <LogOut className="size-4" />
              <span className="whitespace-nowrap">
                {loggingOut ? "Signing out…" : "Log out"}
              </span>
            </Button>
          </div>
        </header>

        <main
          className={cn(
            "mx-auto w-full max-w-3xl flex-1 px-3 py-4 sm:px-4 sm:py-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain",
            showBottomNav
              ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-5"
              : "pb-4",
          )}
        >
          <PageSuspense>
            <PageTransition>
              <Outlet key={user?.id} />
            </PageTransition>
          </PageSuspense>
        </main>

        {showBottomNav && (
          <nav
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
            aria-label="Approvals navigation"
          >
            <div className="mx-auto flex max-w-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                const hasBadge = item.badge && unreadCount > 0;
                const active = item.to === activeNavTo;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onMouseEnter={() => prefetchRoute(item.to)}
                    onFocus={() => prefetchRoute(item.to)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
                      active ? "text-asphalt-mid" : "text-muted-foreground",
                    )}
                  >
                    <span className="relative inline-flex">
                      <Icon
                        className={cn(
                          "size-5",
                          active ? "text-asphalt-mid" : "text-muted-foreground",
                        )}
                      />
                      {hasBadge && (
                        <ActivityDot className="right-0 top-0 translate-x-1/2 -translate-y-1/2" />
                      )}
                    </span>
                    {item.mobileLabel}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
