import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  getHomePathForRoles,
  getPrimaryRole,
  isAppRole,
  roleLabels,
  type AppRole,
} from "@frs/shared";
import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";

const roleOpenings: Record<
  AppRole,
  { title: string; summary: string; permissions: string[] }
> = {
  FIELD_LEAD: {
    title: "Field workspace",
    summary: "Submit daily quantities from the job site.",
    permissions: [
      "Search active projects",
      "Enter STA / location quantities",
      "Attach tickets & photos",
      "Submit & correct returned reports",
    ],
  },
  DIVISION_MANAGER: {
    title: "Approvals workspace",
    summary:
      "Review crew/division reports and keep billing data verified.",
    permissions: [
      "Pending approval queue",
      "Approve, approve with notes, or return",
      "Report age on pending items",
      "Project report history",
    ],
  },
  PROJECT_ADMIN: {
    title: "Office workspace",
    summary: "Work from approved reports only for pay-app backup.",
    permissions: [
      "Project rollups & billing readiness",
      "Approved quantity drilldown",
      "Attachment access",
      "CSV export for pay applications",
    ],
  },
  SYSTEM_ADMIN: {
    title: "System workspace",
    summary: "Configure users, projects, imports, and settings.",
    permissions: [
      "Manage users & roles",
      "Project / bid item setup",
      "Foundation CSV import",
      "Permission matrix",
    ],
  },
};

export function HomePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const primary = getPrimaryRole(user.roles);
  const opening = primary ? roleOpenings[primary] : null;

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

  return (
    <div className="auth-grid-noise min-h-svh">
      <header className="border-b border-asphalt/10 bg-asphalt text-primary-foreground">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center bg-lane font-display text-sm font-bold text-asphalt">
              AT
            </div>
            <div>
              <p className="font-display text-sm font-semibold tracking-wide">
                Advance Traffic
              </p>
              <p className="text-[10px] uppercase tracking-[0.16em] text-steel">
                Field Reporting · Role-based access
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out…" : "Log out"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <div className="mb-6 h-1.5 w-16 bg-lane" />
        <h1 className="font-display text-3xl font-semibold text-asphalt-mid sm:text-4xl">
          Welcome, {user.firstName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Your roles
            </p>
            <p className="mt-2 font-medium text-foreground">
              {user.roles
                .filter(isAppRole)
                .map((r) => roleLabels[r])
                .join(" · ") || user.roles.join(" · ")}
            </p>
            {primary && (
              <p className="mt-2 text-xs text-muted-foreground">
                Primary opening: {roleLabels[primary]}
              </p>
            )}
          </div>
          <div className="rounded-md border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Workspace
            </p>
            <p className="mt-2 font-medium text-foreground">
              {opening?.title ?? "FRS home"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {opening?.summary ??
                "Permissions are enforced by your assigned role."}
            </p>
          </div>
        </div>

        {opening && (
          <div className="mt-4 rounded-md border border-border bg-card p-5 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              What you can do
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {opening.permissions.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span className="mt-1.5 inline-block size-1.5 shrink-0 bg-lane" />
                  {item}
                </li>
              ))}
            </ul>
            {primary === "FIELD_LEAD" && (
              <div className="mt-4">
                <Button
                  className="bg-asphalt-mid text-white hover:bg-asphalt"
                  onClick={() => navigate("/field/projects")}
                >
                  Open projects
                </Button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/** Redirect /app to the role-specific home path */
export function RoleHomeRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={getHomePathForRoles(user.roles)} replace />;
}
