import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { getHomePathForRoles } from "@frs/shared";
import { AppBootScreen } from "@/components/page-shell";
import { ProtectedRoute } from "@/auth/protected-route";
import { RequirePermission } from "@/auth/require-permission";
import { useAuth } from "@/auth/auth-context";
import { WorkspaceLayout } from "@/layouts/system-layout";
import { FieldLayout } from "@/layouts/field-layout";
import { ApprovalsLayout } from "@/layouts/approvals-layout";
import { RoleHomeRedirect } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";

const SystemUsersPage = lazy(() =>
  import("@/pages/system/users-page").then((m) => ({ default: m.SystemUsersPage })),
);
const SystemPermissionsPage = lazy(() =>
  import("@/pages/system/permissions-page").then((m) => ({
    default: m.SystemPermissionsPage,
  })),
);
const WorkspaceOverviewPage = lazy(() =>
  import("@/pages/workspace/overview-page").then((m) => ({
    default: m.WorkspaceOverviewPage,
  })),
);
const ProjectsPage = lazy(() =>
  import("@/pages/workspace/projects-page").then((m) => ({ default: m.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import("@/pages/workspace/project-detail-page").then((m) => ({
    default: m.ProjectDetailPage,
  })),
);
const ProjectTypesPage = lazy(() =>
  import("@/pages/workspace/project-types-page").then((m) => ({
    default: m.ProjectTypesPage,
  })),
);
const UnitsPage = lazy(() =>
  import("@/pages/workspace/units-page").then((m) => ({ default: m.UnitsPage })),
);
const ClientsPage = lazy(() =>
  import("@/pages/workspace/clients-page").then((m) => ({ default: m.ClientsPage })),
);
const TasksPage = lazy(() =>
  import("@/pages/workspace/tasks-page").then((m) => ({ default: m.TasksPage })),
);
const BillingRollupPage = lazy(() =>
  import("@/pages/workspace/billing-rollup-page").then((m) => ({
    default: m.BillingRollupPage,
  })),
);
const BillingDrilldownPage = lazy(() =>
  import("@/pages/workspace/billing-drilldown-page").then((m) => ({
    default: m.BillingDrilldownPage,
  })),
);
const WorkspaceReportsRollupPage = lazy(() =>
  import("@/pages/workspace/reports-rollup-page").then((m) => ({
    default: m.WorkspaceReportsRollupPage,
  })),
);
const WorkspaceReportsDetailPage = lazy(() =>
  import("@/pages/workspace/reports-detail-page").then((m) => ({
    default: m.WorkspaceReportsDetailPage,
  })),
);
const WorkspaceReportViewPage = lazy(() =>
  import("@/pages/workspace/report-view-page").then((m) => ({
    default: m.WorkspaceReportViewPage,
  })),
);
const WorkspaceApprovalHistoryPage = lazy(() =>
  import("@/pages/workspace/approval-history-page").then((m) => ({
    default: m.WorkspaceApprovalHistoryPage,
  })),
);
const FieldProjectsPage = lazy(() =>
  import("@/pages/field/projects-page").then((m) => ({ default: m.FieldProjectsPage })),
);
const FieldProjectDetailPage = lazy(() =>
  import("@/pages/field/project-detail-page").then((m) => ({
    default: m.FieldProjectDetailPage,
  })),
);
const FieldTaskEntryPage = lazy(() =>
  import("@/pages/field/task-entry-page").then((m) => ({ default: m.FieldTaskEntryPage })),
);
const FieldReportsPage = lazy(() =>
  import("@/pages/field/reports-page").then((m) => ({ default: m.FieldReportsPage })),
);
const FieldReportDetailPage = lazy(() =>
  import("@/pages/field/report-detail-page").then((m) => ({
    default: m.FieldReportDetailPage,
  })),
);
const ApprovalsQueuePage = lazy(() =>
  import("@/pages/approvals/queue-page").then((m) => ({ default: m.ApprovalsQueuePage })),
);
const ApprovalsDetailPage = lazy(() =>
  import("@/pages/approvals/detail-page").then((m) => ({ default: m.ApprovalsDetailPage })),
);
const ApprovalsHistoryPage = lazy(() =>
  import("@/pages/approvals/history-page").then((m) => ({
    default: m.ApprovalsHistoryPage,
  })),
);
const AdminApprovalsPage = lazy(() =>
  import("@/pages/workspace/admin-approvals-page").then((m) => ({
    default: m.AdminApprovalsPage,
  })),
);
const AdminApprovalsProjectPage = lazy(() =>
  import("@/pages/workspace/admin-approvals-project-page").then((m) => ({
    default: m.AdminApprovalsProjectPage,
  })),
);

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return <AppBootScreen />;
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={getHomePathForRoles(user.roles)} replace />;
}

function projectRoutes(base: "system" | "office") {
  return (
    <>
      <Route
        index
        element={<WorkspaceOverviewPage kind={base} />}
      />
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
          <RequirePermission permission="projects.manage"> <ProjectDetailPage /> </RequirePermission>
        }
      />
      {base === "system" ? (
        <>
          <Route
            path="project-types"
            element={
              <RequirePermission permission="projects.manage">
                {" "}
                <ProjectTypesPage />{" "}
              </RequirePermission>
            }
          />
          <Route
            path="units"
            element={
              <RequirePermission permission="projects.manage">
                {" "}
                <UnitsPage />{" "}
              </RequirePermission>
            }
          />
          <Route
            path="clients"
            element={
              <RequirePermission permission="projects.manage">
                {" "}
                <ClientsPage />{" "}
              </RequirePermission>
            }
          />
          <Route
            path="bids"
            element={
              <RequirePermission permission="projects.manage">
                {" "}
                <TasksPage />{" "}
              </RequirePermission>
            }
          />
          <Route
            path="tasks"
            element={<Navigate to="bids" relative="path" replace />}
          />
        </>
      ) : (
        <>
          <Route path="project-types" element={<Navigate to="/office" replace />} />
          <Route path="units" element={<Navigate to="/office" replace />} />
          <Route path="clients" element={<Navigate to="/office" replace />} />
          <Route path="bids" element={<Navigate to="/office" replace />} />
          <Route path="tasks" element={<Navigate to="/office" replace />} />
        </>
      )}
      <Route
        path="reports"
        element={
          <RequirePermission permission="reports.view_project_history"> <WorkspaceReportsRollupPage base={base} /> </RequirePermission>
        }
      />
      <Route
        path="reports/history"
        element={
          base === "office" ? (
            <RequirePermission permission="reports.view_project_history">
              {" "}
              <WorkspaceApprovalHistoryPage base={base} />{" "}
            </RequirePermission>
          ) : (
            <Navigate to="/system/approvals" replace />
          )
        }
      />
      <Route
        path="reports/:projectId/:reportId"
        element={
          <RequirePermission permission="reports.view_project_history"> <WorkspaceReportViewPage base={base} /> </RequirePermission>
        }
      />
      <Route
        path="reports/:projectId"
        element={
          <RequirePermission permission="reports.view_project_history"> <WorkspaceReportsDetailPage base={base} /> </RequirePermission>
        }
      />
      <Route
        path="billing"
        element={
          <RequirePermission permission="reports.view_approved"> <BillingRollupPage base={base} /> </RequirePermission>
        }
      />
      <Route
        path="billing/:projectId"
        element={
          <RequirePermission permission="reports.view_approved"> <BillingDrilldownPage base={base} /> </RequirePermission>
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
              <RequirePermission permission="projects.search"> <FieldProjectsPage /> </RequirePermission>
            }
          />
          <Route
            path="projects/:projectId"
            element={
              <RequirePermission permission="projects.search"> <FieldProjectDetailPage /> </RequirePermission>
            }
          />
          <Route
            path="projects/:projectId/tasks/:taskId"
            element={
              <RequirePermission permission="reports.edit_draft"> <FieldTaskEntryPage /> </RequirePermission>
            }
          />
          <Route
            path="reports"
            element={
              <RequirePermission permission="reports.submit"> <FieldReportsPage /> </RequirePermission>
            }
          />
          <Route
            path="reports/:reportId"
            element={
              <RequirePermission permission="reports.submit"> <FieldReportDetailPage /> </RequirePermission>
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
              <RequirePermission permission="reports.view_pending_queue"> <ApprovalsQueuePage /> </RequirePermission>
            }
          />
          <Route
            path="history"
            element={
              <RequirePermission permission="reports.view_project_history"> <ApprovalsHistoryPage /> </RequirePermission>
            }
          />
          <Route
            path=":reportId"
            element={
              <RequirePermission permission="reports.view_pending_queue"> <ApprovalsDetailPage /> </RequirePermission>
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
              <RequirePermission permission="users.manage"> <SystemUsersPage /> </RequirePermission>
            }
          />
          <Route
            path="permissions"
            element={
              <RequirePermission permission="permissions.manage"> <SystemPermissionsPage /> </RequirePermission>
            }
          />
          <Route
            path="approvals"
            element={
              <RequirePermission permission="reports.view_pending_queue"> <AdminApprovalsPage base="system" /> </RequirePermission>
            }
          />
          <Route
            path="approvals/projects/:projectId"
            element={
              <RequirePermission permission="reports.view_project_history"> <AdminApprovalsProjectPage base="system" /> </RequirePermission>
            }
          />
          <Route
            path="approvals/reports/:reportId"
            element={
              <RequirePermission permission="reports.view_pending_queue"> <ApprovalsDetailPage listPath="/system/approvals" /> </RequirePermission>
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
