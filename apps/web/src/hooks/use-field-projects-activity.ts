import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  getKnownFieldTaskIds,
  isFieldTaskNew,
  markFieldTasksKnown,
} from "@/lib/activity-seen";
import { useActivitySeenRevision } from "@/hooks/use-activity-seen-revision";

type FieldProjectsSummary = {
  newTaskCount: number;
  tasks: { id: string; projectId: string; createdAt: string }[];
};

export function useFieldProjectsActivity(userId: string | undefined) {
  const [tasks, setTasks] = useState<FieldProjectsSummary["tasks"]>([]);
  const seenRevision = useActivitySeenRevision("known_field_tasks");

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

  // First session: treat existing assignments as already seen (only future ones badge).
  useEffect(() => {
    if (!userId || tasks.length === 0) return;
    if (getKnownFieldTaskIds(userId).size > 0) return;
    markFieldTasksKnown(
      userId,
      tasks.map((t) => t.id),
    );
  }, [tasks, userId]);

  const unreadCount = useMemo(() => {
    if (!userId) return 0;
    const known = getKnownFieldTaskIds(userId);
    return tasks.filter((t) => !known.has(t.id)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read localStorage on seenRevision
  }, [tasks, userId, seenRevision]);

  const isProjectNew = useCallback(
    (projectId: string) =>
      tasks.some(
        (t) => t.projectId === projectId && isFieldTaskNew(userId, t.id),
      ),
    [tasks, userId, seenRevision],
  );

  return { unreadCount, isProjectNew, refresh };
}
