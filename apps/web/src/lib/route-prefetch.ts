import { getHomePathForRoles } from "@frs/shared";
import { prefetchRoute } from "@/lib/route-prefetch";

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

/** Warm the user's home screen after login to cut first-navigation wait. */
export function prefetchHomeForRoles(roles: string[]) {
  const home = getHomePathForRoles(roles);
  prefetchRoute(home);
  if (home.startsWith("/field")) {
    prefetchRoute("/field/projects");
    prefetchRoute("/field/reports");
  } else if (home.startsWith("/approvals")) {
    prefetchRoute("/approvals/history");
  } else if (home.startsWith("/office")) {
    prefetchRoute("/office/projects");
  } else if (home.startsWith("/system")) {
    prefetchRoute("/system/projects");
    prefetchRoute("/system/users");
  }
}
