import { Navigate } from "react-router-dom";
import { getHomePathForRoles } from "@frs/shared";
import { useAuth } from "@/auth/auth-context";

/** Redirect /app and /admin to the role-specific home path */
export function RoleHomeRedirect() {
  const { user } = useAuth();
  if (!user) return null;
  return <Navigate to={getHomePathForRoles(user.roles)} replace />;
}
