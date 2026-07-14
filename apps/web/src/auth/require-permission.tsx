import { Navigate } from "react-router-dom";
import { getHomePathForRoles } from "@frs/shared";
import { useAuth } from "@/auth/auth-context";

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { can, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
    );
  }

  if (!can(permission)) {
    return (
      <Navigate
        to={user ? getHomePathForRoles(user.roles) : "/login"}
        replace
      />
    );
  }

  return children;
}
