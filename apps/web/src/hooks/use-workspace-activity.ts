import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/auth/auth-context";
import { isProjectNew } from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";

type BillingSummary = {
  totalPending: number;
  projectsWithPending: number;
};

type ProjectActivity = {
  id: string;
  createdAt: string;
};

type ProjectsSummary = {
  recentProjectCount: number;
  projects: ProjectActivity[];
};

export function useWorkspaceActivity() {
  const { can, user } = useAuth();
  const [billingPending, setBillingPending] = useState(0);
  const [recentProjects, setRecentProjects] = useState<ProjectActivity[]>([]);
  const [approvalsPending, setApprovalsPending] = useState(0);
  const seenRevision = useActivitySeenRevision("known_projects");

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
            setRecentProjects(s.projects ?? []);
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

  const unreadProjects = useMemo(() => {
    if (!user?.id) return 0;
    return recentProjects.filter((p) => isProjectNew(user.id, p.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read localStorage on seenRevision
  }, [recentProjects, user?.id, seenRevision]);

  return {
    billingPending,
    recentProjects: unreadProjects,
    approvalsPending,
    refresh,
  };
}
