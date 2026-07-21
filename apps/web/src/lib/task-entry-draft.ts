const DRAFT_PREFIX = "frs_task_draft_v1_";

export type TaskEntryDraft = {
  notes: string;
  staSegs: Array<{
    beginSta: string;
    endSta: string;
    conversionFactor: string;
    useManualLf: boolean;
    manualLf: string;
  }>;
  locSegs: Array<{
    locationDescription: string;
    symbolItemType: string;
    quantity: string;
  }>;
  defaultCf: string;
  defaultSymbol: string;
  defaultUnit: string;
  savedAt: number;
};

export function taskDraftKey(projectId: string, taskId: string) {
  return `${DRAFT_PREFIX}${projectId}_${taskId}`;
}

export function loadTaskEntryDraft(
  projectId: string,
  taskId: string,
): TaskEntryDraft | null {
  try {
    const raw = localStorage.getItem(taskDraftKey(projectId, taskId));
    if (!raw) return null;
    return JSON.parse(raw) as TaskEntryDraft;
  } catch {
    return null;
  }
}

export function saveTaskEntryDraft(
  projectId: string,
  taskId: string,
  draft: Omit<TaskEntryDraft, "savedAt">,
) {
  try {
    const payload: TaskEntryDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(taskDraftKey(projectId, taskId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearTaskEntryDraft(projectId: string, taskId: string) {
  try {
    localStorage.removeItem(taskDraftKey(projectId, taskId));
  } catch {
    /* ignore */
  }
}
