import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getKnownFieldTaskIds, isFieldTaskNew } from "@/lib/activity-seen";

type FieldProjectsSummary = {
  newTaskCount: number;
  tasks: { id: string; projectId: string; createdAt: string }[];
};

export function useFieldProjectsActivity(userId: string | undefined) {
  const [tasks, setTasks] = useState<FieldProjectsSummary["tasks"]>([]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await apiFetch<FieldProjectsSummary>(
        "/api/v1/field/projects/summary",
      );
      setTasks(data.tasks);
    } catch {
      /* non-blocking */
    }
  }, [userId]);

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

  const unreadCount = useMemo(() => {
    if (!userId) return 0;
    const known = getKnownFieldTaskIds(userId);
    return tasks.filter((t) => !known.has(t.id)).length;
  }, [tasks, userId]);

  const isProjectNew = useCallback(
    (projectId: string) =>
      tasks.some((t) => t.projectId === projectId && isFieldTaskNew(userId, t.id)),
    [tasks, userId],
  );

  return { unreadCount, isProjectNew, refresh };
}
