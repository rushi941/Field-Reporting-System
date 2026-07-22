const PREFIX = "frs_activity_seen";

export const ACTIVITY_SEEN_EVENT = "frs:activity-seen";

export function notifyActivitySeen(scope?: string) {
  window.dispatchEvent(
    new CustomEvent(ACTIVITY_SEEN_EVENT, { detail: { scope } }),
  );
}

function key(userId: string, scope: string) {
  return `${PREFIX}:${userId}:${scope}`;
}

function readMap(userId: string, scope: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key(userId, scope));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

function writeMap(userId: string, scope: string, map: Record<string, string>) {
  localStorage.setItem(key(userId, scope), JSON.stringify(map));
}

export type ReportActivityInput = {
  id: string;
  status: string;
  returnedAt?: string | Date | null;
  approvedAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export function reportActivityToken(r: ReportActivityInput): string {
  const returned =
    r.returnedAt instanceof Date
      ? r.returnedAt.toISOString()
      : (r.returnedAt ?? "");
  const approved =
    r.approvedAt instanceof Date
      ? r.approvedAt.toISOString()
      : (r.approvedAt ?? "");
  const updated =
    r.updatedAt instanceof Date
      ? r.updatedAt.toISOString()
      : (r.updatedAt ?? "");
  return `${r.status}|${returned}|${approved}|${updated}`;
}

const FIELD_ACTIVITY_STATUSES = new Set([
  "RETURNED",
  "APPROVED",
  "APPROVED_WITH_NOTES",
]);

export function isFieldReportUnread(
  userId: string | undefined,
  report: ReportActivityInput,
): boolean {
  if (!userId || !FIELD_ACTIVITY_STATUSES.has(report.status)) return false;
  const map = readMap(userId, "field_reports");
  return map[report.id] !== reportActivityToken(report);
}

export function markFieldReportSeen(
  userId: string | undefined,
  report: ReportActivityInput,
) {
  if (!userId) return;
  const map = readMap(userId, "field_reports");
  map[report.id] = reportActivityToken(report);
  writeMap(userId, "field_reports", map);
  notifyActivitySeen("field_reports");
}

export type PendingActivityInput = {
  id: string;
  submittedAt?: string | Date | null;
};

export function pendingActivityToken(r: PendingActivityInput): string {
  if (!r.submittedAt) return r.id;
  return r.submittedAt instanceof Date
    ? r.submittedAt.toISOString()
    : r.submittedAt;
}

export function isPendingApprovalUnread(
  userId: string | undefined,
  report: PendingActivityInput,
): boolean {
  if (!userId) return false;
  const map = readMap(userId, "pending_approvals");
  return map[report.id] !== pendingActivityToken(report);
}

export function markPendingApprovalSeen(
  userId: string | undefined,
  report: PendingActivityInput,
) {
  if (!userId) return;
  const map = readMap(userId, "pending_approvals");
  map[report.id] = pendingActivityToken(report);
  writeMap(userId, "pending_approvals", map);
  notifyActivitySeen("pending_approvals");
}

export function getKnownProjectIds(userId: string | undefined): Set<string> {
  if (!userId) return new Set();
  const map = readMap(userId, "known_projects");
  return new Set(Object.keys(map));
}

export function isProjectNew(
  userId: string | undefined,
  projectId: string,
): boolean {
  if (!userId) return false;
  return !getKnownProjectIds(userId).has(projectId);
}

export function markProjectsKnown(
  userId: string | undefined,
  projectIds: string[],
) {
  if (!userId) return;
  const map = readMap(userId, "known_projects");
  for (const id of projectIds) {
    map[id] = new Date().toISOString();
  }
  writeMap(userId, "known_projects", map);
  notifyActivitySeen("known_projects");
}

export function getKnownFieldTaskIds(userId: string | undefined): Set<string> {
  if (!userId) return new Set();
  const map = readMap(userId, "known_field_tasks");
  return new Set(Object.keys(map));
}

export function isFieldTaskNew(
  userId: string | undefined,
  taskId: string,
): boolean {
  if (!userId) return false;
  return !getKnownFieldTaskIds(userId).has(taskId);
}

export function markFieldTasksKnown(
  userId: string | undefined,
  taskIds: string[],
) {
  if (!userId) return;
  const map = readMap(userId, "known_field_tasks");
  for (const id of taskIds) {
    map[id] = new Date().toISOString();
  }
  writeMap(userId, "known_field_tasks", map);
  notifyActivitySeen("known_field_tasks");
}

export type BillingPendingInput = {
  id: string;
  pendingCount: number;
};

export function billingPendingToken(p: BillingPendingInput): string {
  return String(p.pendingCount);
}

export function isBillingProjectUnread(
  userId: string | undefined,
  project: BillingPendingInput,
): boolean {
  if (!userId || project.pendingCount <= 0) return false;
  const map = readMap(userId, "billing_pending");
  return map[project.id] !== billingPendingToken(project);
}

export function markBillingProjectSeen(
  userId: string | undefined,
  project: BillingPendingInput,
) {
  if (!userId) return;
  const map = readMap(userId, "billing_pending");
  map[project.id] = billingPendingToken(project);
  writeMap(userId, "billing_pending", map);
  notifyActivitySeen("billing_pending");
}
