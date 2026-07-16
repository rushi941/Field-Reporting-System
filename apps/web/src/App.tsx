import { Navigate, Route, Routes } from "react-router-dom";
import { getHomePathForRoles } from "@frs/shared";
import { ProtectedRoute } from "@/auth/protected-route";
import { RequirePermission } from "@/auth/require-permission";
import { useAuth } from "@/auth/auth-context";
import { WorkspaceLayout } from "@/layouts/system-layout";
import { FieldLayout } from "@/layouts/field-layout";
import { ApprovalsLayout } from "@/layouts/approvals-layout";
import { RoleHomeRedirect } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { SystemUsersPage } from "@/pages/system/users-page";
import { SystemPermissionsPage } from "@/pages/system/permissions-page";
import { WorkspaceOverviewPage } from "@/pages/workspace/overview-page";
import { ProjectsPage } from "@/pages/workspace/projects-page";
import { ProjectDetailPage } from "@/pages/workspace/project-detail-page";
import { ProjectTypesPage } from "@/pages/workspace/project-types-page";
import { UnitsPage } from "@/pages/workspace/units-page";
import { TasksPage } from "@/pages/workspace/tasks-page";
import { BillingRollupPage } from "@/pages/workspace/billing-rollup-page";
import { BillingDrilldownPage } from "@/pages/workspace/billing-drilldown-page";
import { FieldProjectsPage } from "@/pages/field/projects-page";
import { FieldProjectDetailPage } from "@/pages/field/project-detail-page";
import { FieldTaskEntryPage } from "@/pages/field/task-entry-page";
import { FieldReportsPage } from "@/pages/field/reports-page";
import { FieldReportDetailPage } from "@/pages/field/report-detail-page";
import { ApprovalsQueuePage } from "@/pages/approvals/queue-page";
import { ApprovalsDetailPage } from "@/pages/approvals/detail-page";
import { ApprovalsHistoryPage } from "@/pages/approvals/history-page";

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePathForRoles(user.roles)} replace />;
}

function projectRoutes(base: "system" | "office") {
  return (
    <>
      <Route index element={<WorkspaceOverviewPage kind={base} />} />
      <Route
        path="projects"
        element={
          <RequirePermission permission="projects.manage">
            <ProjectsPage />
          </RequirePermission>
        }
      />
      <Route
        path="projects/:projectId"
        element={
          <RequirePermission permission="projects.manage">
            <ProjectDetailPage />
          </RequirePermission>
        }
      />
      <Route
        path="project-types"
        element={
          <RequirePermission permission="projects.manage">
            <ProjectTypesPage />
          </RequirePermission>
        }
      />
      <Route
        path="units"
        element={
          <RequirePermission permission="projects.manage">
            <UnitsPage />
          </RequirePermission>
        }
      />
      <Route
        path="bids"
        element={
          <RequirePermission permission="projects.manage">
            <TasksPage />
          </RequirePermission>
        }
      />
      <Route
        path="tasks"
        element={<Navigate to="bids" relative="path" replace />}
      />
      <Route
        path="billing"
        element={
          <RequirePermission permission="reports.view_approved">
            <BillingRollupPage base={base} />
          </RequirePermission>
        }
      />
      <Route
        path="billing/:projectId"
        element={
          <RequirePermission permission="reports.view_approved">
            <BillingDrilldownPage base={base} />
          </RequirePermission>
        }
      />
    </>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/field" element={<FieldLayout />}>
          <Route index element={<Navigate to="projects" replace />} />
          <Route
            path="projects"
            element={
              <RequirePermission permission="projects.search">
                <FieldProjectsPage />
              </RequirePermission>
            }
          />
          <Route
            path="projects/:projectId"
            element={
              <RequirePermission permission="projects.search">
                <FieldProjectDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="projects/:projectId/tasks/:taskId"
            element={
              <RequirePermission permission="reports.edit_draft">
                <FieldTaskEntryPage />
              </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission permission="reports.submit">
                <FieldReportsPage />
              </RequirePermission>
            }
          />
          <Route
            path="reports/:reportId"
            element={
              <RequirePermission permission="reports.submit">
                <FieldReportDetailPage />
              </RequirePermission>
            }
          />
        </Route>
        <Route
          path="/field/jobs"
          element={<Navigate to="/field/projects" replace />}
        />

        <Route path="/approvals" element={<ApprovalsLayout />}>
          <Route
            index
            element={
              <RequirePermission permission="reports.view_pending_queue">
                <ApprovalsQueuePage />
              </RequirePermission>
            }
          />
          <Route
            path="history"
            element={
              <RequirePermission permission="reports.view_project_history">
                <ApprovalsHistoryPage />
              </RequirePermission>
            }
          />
          <Route
            path=":reportId"
            element={
              <RequirePermission permission="reports.view_pending_queue">
                <ApprovalsDetailPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="/office" element={<WorkspaceLayout kind="office" />}>
          {projectRoutes("office")}
        </Route>

        <Route path="/system" element={<WorkspaceLayout kind="system" />}>
          {projectRoutes("system")}
          <Route
            path="users"
            element={
              <RequirePermission permission="users.manage">
                <SystemUsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="permissions"
            element={
              <RequirePermission permission="permissions.manage">
                <SystemPermissionsPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="/app" element={<RoleHomeRedirect />} />
        <Route path="/admin" element={<RoleHomeRedirect />} />
      </Route>
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
