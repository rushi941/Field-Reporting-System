import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/auth/auth-context";

type BillingSummary = {
  totalPending: number;
  projectsWithPending: number;
};

type ProjectsSummary = {
  recentProjectCount: number;
};

export function useWorkspaceActivity() {
  const { can } = useAuth();
  const [billingPending, setBillingPending] = useState(0);
  const [recentProjects, setRecentProjects] = useState(0);
  const [approvalsPending, setApprovalsPending] = useState(0);

  const refresh = useCallback(async () => {
    const tasks: Promise<void>[] = [];

    if (can("reports.view_approved")) {
      tasks.push(
        apiFetch<BillingSummary>("/api/v1/billing/summary")
          .then((s) => {
            setBillingPending(s.totalPending);
          })
          .catch(() => {}),
      );
    }

    if (can("projects.manage")) {
      tasks.push(
        apiFetch<ProjectsSummary>("/api/v1/projects/activity-summary")
          .then((s) => {
            setRecentProjects(s.recentProjectCount);
          })
          .catch(() => {}),
      );
    }

    if (can("reports.view_pending_queue")) {
      tasks.push(
        apiFetch<{ pendingCount: number }>("/api/v1/approvals/summary")
          .then((s) => {
            setApprovalsPending(s.pendingCount);
          })
          .catch(() => {}),
      );
    }

    await Promise.all(tasks);
  }, [can]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  return {
    billingPending,
    recentProjects,
    approvalsPending,
    refresh,
  };
}
