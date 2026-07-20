import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, FolderKanban, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/field/projects", label: "Projects", icon: FolderKanban },
  { to: "/field/reports", label: "Reports", icon: ClipboardList },
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
            Field Lead
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-steel">
          Menu
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
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
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 rounded-md bg-sidebar-muted px-3 py-2.5">
          <p className="truncate text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </p>
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
      <div className="sticky top-0 hidden h-svh shrink-0 md:block">{sidebar}</div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-3 backdrop-blur md:h-14 md:bg-card/95 md:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded bg-lane font-display text-xs font-bold text-asphalt md:hidden">
              AT
            </div>
            <div className="min-w-0 md:hidden">
              {showBottomNav ? (
                <>
                  <p className="truncate text-sm font-semibold text-foreground">
                    Field Reporting
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                </>
              ) : (
                <p className="truncate text-sm font-semibold text-foreground">
                  Daily report
                </p>
              )}
            </div>
            <p className="hidden truncate text-sm font-semibold text-foreground md:block">
              Field Reporting
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 gap-1.5 px-2 text-muted-foreground md:hidden"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="size-4" />
            <span className="sr-only sm:not-sr-only">
              {loggingOut ? "…" : "Log out"}
            </span>
          </Button>
        </header>

        <main
          className={cn(
            "flex-1 px-3 py-4 md:px-4 md:py-5",
            showBottomNav ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-5" : "pb-4",
          )}
        >
          <div className="mx-auto w-full max-w-lg">
            <Outlet />
          </div>
        </main>

        {showBottomNav && (
          <nav
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
            aria-label="Field navigation"
          >
            <div className="mx-auto flex max-w-lg">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/field/projects" || item.to === "/field/reports"}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold transition-colors",
                        isActive
                          ? "text-asphalt-mid"
                          : "text-muted-foreground",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          className={cn(
                            "size-5",
                            isActive ? "text-asphalt-mid" : "text-muted-foreground",
                          )}
                        />
                        {item.label}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
