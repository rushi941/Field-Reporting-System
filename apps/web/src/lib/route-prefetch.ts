const prefetched = new Set<string>();

const routeLoaders: Record<string, () => Promise<unknown>> = {
  "/field/projects": () => import("@/pages/field/projects-page"),
  "/field/reports": () => import("@/pages/field/reports-page"),
  "/approvals": () => import("@/pages/approvals/queue-page"),
  "/approvals/history": () => import("@/pages/approvals/history-page"),
  "/office": () => import("@/pages/workspace/overview-page"),
  "/office/projects": () => import("@/pages/workspace/projects-page"),
  "/system": () => import("@/pages/workspace/overview-page"),
  "/system/projects": () => import("@/pages/workspace/projects-page"),
};

export function prefetchRoute(path: string) {
  const loader = routeLoaders[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader();
}
