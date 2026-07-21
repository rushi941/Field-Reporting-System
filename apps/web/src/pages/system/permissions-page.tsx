import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  roles,
  roleLabels,
  toYesNoAccess,
  updatePermissionMatrixSchema,
  type AppRole,
  type PermissionAccessValue,
} from "@frs/shared";
import { apiFetch, type PermissionMatrixRow } from "@/lib/api";
import { firstZodIssueMessage } from "@/lib/zod-error";
import { Button } from "@/components/ui/button";

const yesNoOptions: { value: PermissionAccessValue; label: string }[] = [
  { value: "YES", label: "Yes" },
  { value: "NO", label: "No" },
];

function normalizeMatrix(rows: PermissionMatrixRow[]): PermissionMatrixRow[] {
  return rows.map((row) => ({
    ...row,
    accessByRole: Object.fromEntries(
      Object.entries(row.accessByRole).map(([role, access]) => [
        role,
        toYesNoAccess(access),
      ]),
    ),
  }));
}

export function SystemPermissionsPage() {
  const [matrix, setMatrix] = useState<PermissionMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<{ matrix: PermissionMatrixRow[] }>(
        "/api/v1/permissions/matrix",
      );
      setMatrix(normalizeMatrix(data.matrix));
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load permissions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function setAccess(permissionKey: string, role: AppRole, access: string) {
    setMatrix((rows) =>
      rows.map((row) =>
        row.key === permissionKey
          ? {
              ...row,
              accessByRole: {
                ...row.accessByRole,
                [role]: toYesNoAccess(access),
              },
            }
          : row,
      ),
    );
    setDirty(true);
  }

  async function save() {
    if (!dirty) {
      toast.message("No changes to save");
      return;
    }
    setSaving(true);
    try {
      const cells = matrix.flatMap((row) =>
        roles.map((role) => ({
          permissionKey: row.key,
          role,
          access: toYesNoAccess(row.accessByRole[role] ?? "NO"),
        })),
      );
      const parsed = updatePermissionMatrixSchema.safeParse({ cells });
      if (!parsed.success) {
        toast.error(firstZodIssueMessage(parsed.error));
        return;
      }
      const data = await apiFetch<{ matrix: PermissionMatrixRow[] }>(
        "/api/v1/permissions/matrix",
        {
          method: "PUT",
          body: JSON.stringify(parsed.data),
        },
      );
      setMatrix(normalizeMatrix(data.matrix));
      setDirty(false);
      toast.success("Permission matrix saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save permissions");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Configuration
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Permissions
          </h1>
        </div>
        <Button
          className="bg-asphalt-mid text-white hover:bg-asphalt"
          onClick={save}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save matrix"
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-muted/60 px-4 py-3 font-semibold">
                  Feature
                </th>
                {roles.map((role) => (
                  <th key={role} className="px-3 py-3 font-medium">
                    {roleLabels[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <td className="sticky left-0 z-10 bg-card px-3 py-2">
                    <div className="font-medium">{row.label}</div>
                  </td>
                  {roles.map((role) => (
                    <td key={role} className="px-2 py-2">
                      <select
                        className="h-9 w-full min-w-[5.5rem] rounded-md border border-input bg-background px-2 text-xs"
                        value={toYesNoAccess(row.accessByRole[role] ?? "NO")}
                        onChange={(e) =>
                          setAccess(row.key, role, e.target.value)
                        }
                      >
                        {yesNoOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
