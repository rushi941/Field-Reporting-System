import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, FolderKanban, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ActivityDot } from "@/components/activity-dot";
import { PageSuspense, PageTransition } from "@/components/page-shell";
import { prefetchRoute } from "@/lib/route-prefetch";
import { useFieldReportActivity } from "@/hooks/use-field-report-activity";
import { useFieldProjectsActivity } from "@/hooks/use-field-projects-activity";
import { resolveActiveNavTo } from "@/lib/nav-active";
import { UserHeaderIdentity } from "@/components/user-role-pill";
import { BrandLogo, SidebarBrand } from "@/components/brand-logo";

const navItems = [
  { to: "/field/projects", label: "Projects", icon: FolderKanban, badge: "projects" as const },
  { to: "/field/reports", label: "Reports", icon: ClipboardList, badge: "reports" as const },
];

function isFieldListPage(pathname: string) {
  return (
    pathname === "/field" ||
    pathname === "/field/projects" ||
    pathname === "/field/reports"
  );
}

export function FieldLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const showBottomNav = isFieldListPage(location.pathname);
  const activeNavTo = resolveActiveNavTo(navItems, location.pathname);
  const { unreadCount: reportUnread } = useFieldReportActivity(user?.id);
  const { unreadCount: projectUnread } = useFieldProjectsActivity(user?.id);
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const workspaceRole = "FIELD_LEAD" as const;

  function showNavBadge(kind: "projects" | "reports") {
    if (kind === "reports") return reportUnread > 0;
    return projectUnread > 0;
  }

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
        <SidebarBrand roleLabel="Field Lead" />
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasBadge = showNavBadge(item.badge);
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
                {hasBadge && (
                  <ActivityDot className="-right-0.5 -top-0.5 ring-sidebar" />
                )}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-md bg-sidebar-muted px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="truncate text-xs text-steel">{user?.email}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-white/15 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          onClick={handleLogout}
          disabled={loggingOut}
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
            "flex-1 px-3 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:px-4",
            showBottomNav
              ? "pt-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:py-5"
              : "pt-2 pb-4 lg:pt-3 lg:pb-5",
          )}
        >
          <div className="mx-auto w-full min-w-0 max-w-lg overflow-x-hidden">
            <PageSuspense>
              <PageTransition>
                <Outlet key={user?.id} />
              </PageTransition>
            </PageSuspense>
          </div>
        </main>

        {showBottomNav && (
          <nav
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
            aria-label="Field navigation"
          >
            <div className="mx-auto flex max-w-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                const hasBadge = showNavBadge(item.badge);
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
                    <span className="relative">
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
                    {item.label}
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
