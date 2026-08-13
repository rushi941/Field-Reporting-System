import { Navigate } from "react-router-dom";
import { getHomePathForRoles, type AppRole } from "@frs/shared";
import { useAuth } from "@/auth/auth-context";
import type { ReactNode } from "react";

/** Keep each role in its own workspace (e.g. Division Manager never lands in Field Lead). */
export function RequireWorkspace({
  roles: allowed,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) return null;

  const allowedHere = Boolean(
    user?.roles.some((role) => allowed.includes(role as AppRole)),
  );
  if (!user || !allowedHere) {
    return (
      <Navigate
        to={user ? getHomePathForRoles(user.roles) : "/login"}
        replace
      />
    );
  }

  return children;
}
