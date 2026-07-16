import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  FolderKanban,
  ListChecks,
  Loader2,
  Ruler,
  Shield,
  Tags,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth/auth-context";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

type RollupProject = {
  id: string;
  jobNumber: string;
  name: string;
  approvedCount: number;
  pendingCount: number;
  lastReportDate: string | null;
  billingReady: boolean;
};

export function WorkspaceOverviewPage({
  kind,
}: {
  kind: "system" | "office";
}) {
  const { can, user } = useAuth();
  const base = kind === "system" ? "/system" : "/office";
  const [rollup, setRollup] = useState<RollupProject[]>([]);
  const [loadingRollup, setLoadingRollup] = useState(
    kind === "office" && can("reports.view_approved"),
  );

  useEffect(() => {
    if (kind !== "office" || !can("reports.view_approved")) return;
    void (async () => {
      try {
        const data = await apiFetch<{ projects: RollupProject[] }>(
          "/api/v1/billing/rollup",
        );
        setRollup(data.projects);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load dashboard",
        );
      } finally {
        setLoadingRollup(false);
      }
    })();
  }, [kind, can]);

  const totals = useMemo(() => {
    return rollup.reduce(
      (acc, p) => {
        acc.approved += p.approvedCount;
        acc.pending += p.pendingCount;
        if (p.billingReady) acc.ready += 1;
        if (
          p.lastReportDate &&
          (!acc.lastDate || p.lastReportDate > acc.lastDate)
        ) {
          acc.lastDate = p.lastReportDate;
        }
        return acc;
      },
      { approved: 0, pending: 0, ready: 0, lastDate: null as string | null },
    );
  }, [rollup]);

  const cards = [
    {
      to: `${base}/projects`,
      title: "Projects",
      body: "Create and manage jobs with project type, division, and status.",
      icon: FolderKanban,
      permission: "projects.manage",
    },
    {
      to: `${base}/project-types`,
      title: "Project types",
      body: "Master list for pavement marking, traffic control, signs, and more.",
      icon: Tags,
      permission: "projects.manage",
    },
    {
      to: `${base}/units`,
      title: "Units",
      body: "Units of measure — LF, EA, LS, and more for bids and reporting.",
      icon: Ruler,
      permission: "projects.manage",
    },
    {
      to: `${base}/bids`,
      title: "Bid master",
      body: "Master bids and sub-bids by division, with CSV import.",
      icon: ListChecks,
      permission: "projects.manage",
    },
    {
      to: `${base}/billing`,
      title: "Billing",
      body: "Approved report rollup, drilldown, and CSV backup export.",
      icon: FileSpreadsheet,
      permission: "reports.view_approved",
    },
    ...(kind === "system"
      ? [
          {
            to: "/system/users",
            title: "Users",
            body: "Accounts, roles, and active status.",
            icon: Users,
            permission: "users.manage",
          },
          {
            to: "/system/permissions",
            title: "Permissions",
            body: "Role permission matrix (Yes / No).",
            icon: Shield,
            permission: "permissions.manage",
          },
        ]
      : []),
  ];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {kind === "system" ? "System admin" : "Project admin"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {kind === "office" ? "Dashboard" : "Overview"}
      </h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Welcome{user?.firstName ? `, ${user.firstName}` : ""}.
        {kind === "office"
          ? " Approved-only detail · summary pending counts · billing readiness."
          : " Manage projects, users, and settings."}
      </p>

      {kind === "office" && can("reports.view_approved") && (
        <div className="mt-6 space-y-3">
          {loadingRollup ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading rollup…
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label="Approved reports"
                  value={String(totals.approved)}
                />
                <Metric
                  label="Pending approval"
                  value={String(totals.pending)}
                  warn={totals.pending > 0}
                />
                <Metric
                  label="Last report date"
                  value={totals.lastDate ?? "—"}
                />
                <Metric
                  label="Billing ready jobs"
                  value={`${totals.ready}/${rollup.length}`}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`${base}/billing`}
                  className="text-sm font-medium text-sky-800 underline"
                >
                  Open billing rollup
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((c) => !c.permission || can(c.permission))
          .map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                className="rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:border-asphalt/25 hover:shadow-md"
              >
                <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-asphalt text-lane">
                  <Icon className="size-5" />
                </div>
                <p className="text-base font-semibold">{c.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          warn && "text-amber-700",
        )}
      >
        {value}
      </p>
    </div>
  );
}
