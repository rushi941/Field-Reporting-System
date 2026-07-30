export function billingExportPath(projectId: string) {
  return `/api/v1/billing/projects/${projectId}/export.csv`;
}

export function workspaceReportsExportPath(projectId: string) {
  return `/api/v1/workspace-reports/projects/${projectId}/export.csv`;
}

export function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
