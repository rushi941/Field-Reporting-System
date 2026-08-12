import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Users,
  Shield,
  FolderKanban,
  Tags,
  ListChecks,
  FileSpreadsheet,
  ClipboardList,
  ClipboardCheck,
  Ruler,
  Building2,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { ActivityDot } from "@/components/activity-dot";
import { useWorkspaceActivity } from "@/hooks/use-workspace-activity";
import { PageSuspense, PageTransition } from "@/components/page-shell";
import { prefetchRoute } from "@/lib/route-prefetch";
import {
  isBillingNavActive,
  isReportsNavActive,
  resolveActiveNavTo,
} from "@/lib/nav-active";
import { UserHeaderIdentity } from "@/components/user-role-pill";
import { BrandLogo, SidebarBrand } from "@/components/brand-logo";

type WorkspaceKind = "system" | "office";

type NavBadge = "projects" | "billing" | "reports" | "approvals" | null;

type NavItem = {
  to: string;
  end?: boolean;
  label: string;
  icon: typeof LayoutDashboard;
  permission: string | null;
  badge?: NavBadge;
  isActivePath?: (pathname: string) => boolean;
};

const navByKind: Record<WorkspaceKind, NavItem[]> = {
  system: [
    { to: "/system", end: true, label: "Overview", icon: LayoutDashboard, permission: null },
    { to: "/system/projects", label: "Projects", icon: FolderKanban, permission: "projects.manage", badge: "projects" },
    {
      to: "/system/reports",
      label: "Reports",
      icon: ClipboardList,
      permission: "reports.view_project_history",
      badge: "reports",
      isActivePath: (p) => isReportsNavActive(p, "/system/reports"),
    },
    { to: "/system/approvals", label: "Approvals", icon: ClipboardCheck, permission: "reports.view_pending_queue", badge: "approvals" },
    { to: "/system/billing", label: "Billing", icon: FileSpreadsheet, permission: "billing.export", badge: "billing", isActivePath: (p) => isBillingNavActive(p, "/system/billing") },
    { to: "/system/project-types", label: "Project types", icon: Tags, permission: "projects.manage" },
    { to: "/system/units", label: "Units", icon: Ruler, permission: "projects.manage" },
    { to: "/system/clients", label: "Clients", icon: Building2, permission: "projects.manage" },
    { to: "/system/bids", label: "Bid master", icon: ListChecks, permission: "projects.manage" },
    { to: "/system/users", label: "Users", icon: Users, permission: "users.manage" },
    { to: "/system/permissions", label: "Permissions", icon: Shield, permission: "permissions.manage" },
  ],
  office: [
    { to: "/office", end: true, label: "Overview", icon: LayoutDashboard, permission: null },
    { to: "/office/projects", label: "Projects", icon: FolderKanban, permission: "projects.manage", badge: "projects" },
    {
      to: "/office/reports",
      label: "Reports",
      icon: ClipboardList,
      permission: "reports.view_project_history",
      badge: "reports",
      isActivePath: (p) => isReportsNavActive(p, "/office/reports"),
    },
    {
      to: "/office/reports/history",
      end: true,
      label: "Approval history",
      icon: ClipboardCheck,
      permission: "reports.view_project_history",
    },
    {
      to: "/office/billing",
      label: "Billing",
      icon: FileSpreadsheet,
      permission: "billing.export",
      badge: "billing",
      isActivePath: (p) => isBillingNavActive(p, "/office/billing"),
    },
  ],
};

export function WorkspaceLayout({ kind }: { kind: WorkspaceKind }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { billingPending, recentProjects, approvalsPending } = useWorkspaceActivity();

  function showNavBadge(badge: NavBadge | undefined) {
    if (badge === "billing" || badge === "reports") return billingPending > 0;
    if (badge === "approvals") return approvalsPending > 0;
    if (badge === "projects") return recentProjects > 0;
    return false;
  }

  const mobileHasActivity =
    billingPending > 0 || recentProjects > 0 || approvalsPending > 0;

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

  const visibleNav = navByKind[kind].filter(
    (item) => !item.permission || can(item.permission),
  );
  const activeNavTo = resolveActiveNavTo(visibleNav, location.pathname);

  const title = kind === "system" ? "System Admin" : "Project Admin";
  const workspaceRole = kind === "system" ? "SYSTEM_ADMIN" : "PROJECT_ADMIN";
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  const sidebar = (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-slate-200">
      <div className="border-b border-white/10 px-4 py-4">
        <SidebarBrand roleLabel={title} />
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const hasBadge = showNavBadge(item.badge);
          const active = item.to === activeNavTo;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
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

      <div className="shrink-0 border-t border-white/10 p-4">
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
    <div className="flex min-h-svh bg-background">
      <div className="sticky top-0 hidden h-svh shrink-0 self-start bg-sidebar lg:block">
        {sidebar}
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-72 shadow-xl">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative shrink-0 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
              {mobileHasActivity && (
                <ActivityDot className="right-1 top-1" />
              )}
            </Button>
            <BrandLogo
              variant="compact"
              className="min-w-0 shrink lg:hidden"
              imgClassName="h-7 max-w-[11rem] sm:max-w-[13rem]"
            />
            <p className="hidden truncate text-sm font-semibold text-foreground lg:block">
              Field Reporting System
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userName ? (
              <UserHeaderIdentity name={userName} role={workspaceRole} compact />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
            >
              <LogOut className="size-4" />
              <span className="sr-only sm:not-sr-only">
                {loggingOut ? "…" : "Log out"}
              </span>
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <PageSuspense>
              <PageTransition>
                <Outlet key={user?.id} />
              </PageTransition>
            </PageSuspense>
          </div>
        </main>
      </div>
    </div>
  );
}
