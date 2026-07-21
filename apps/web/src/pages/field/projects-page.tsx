import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search } from "lucide-react";
import { ConnectionBanner } from "@/components/connection-banner";
import { OFFLINE_CACHE_KEYS } from "@/lib/offline-cache";
import { useCachedApi } from "@/hooks/use-cached-api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FieldProject = {
  id: string;
  jobNumber: string;
  name: string;
  division: string;
  location: string | null;
  clientName: string | null;
  generalContractor: string | null;
};

type DivisionFilter = "ALL" | "PAVEMENT_MARKING" | "TRAFFIC_CONTROL" | "PERMANENT_SIGNS";

const divisionChips: { value: DivisionFilter; label: string }[] = [
  { value: "ALL", label: "All Divisions" },
  { value: "PAVEMENT_MARKING", label: "Pave Marking" },
  { value: "TRAFFIC_CONTROL", label: "Traffic Control" },
  { value: "PERMANENT_SIGNS", label: "Perm. Signs" },
];

export function FieldProjectsPage() {
  const {
    data,
    loading,
    refreshing,
    fromCache,
    cacheSavedAt,
    error,
    online,
  } = useCachedApi<{ projects: FieldProject[] }>(
    OFFLINE_CACHE_KEYS.fieldProjects,
    "/api/v1/field/projects",
  );

  const projects = data?.projects ?? [];
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<DivisionFilter>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (division !== "ALL" && p.division !== division) return false;
      if (!q) return true;
      return (
        p.jobNumber.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.location?.toLowerCase().includes(q) ?? false) ||
        (p.clientName?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [projects, query, division]);

  return (
    <div className="space-y-5">
      <ConnectionBanner
        online={online}
        fromCache={fromCache}
        refreshing={refreshing}
        cacheSavedAt={cacheSavedAt}
        error={error}
        className="bg-background/80"
      />
      <p className="text-sm text-muted-foreground">
        Select a project to begin your daily report.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by job # or name…"
          className="h-11 pl-9"
        />
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Division
        </p>
        <div
          className={cn(
            "-mx-3 overflow-x-auto px-3 pb-1",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          <div className="flex w-max min-w-full gap-2.5 pr-4">
            {divisionChips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setDivision(chip.value)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2.5 text-xs font-semibold transition active:scale-[0.98]",
                  division === chip.value
                    ? "border-sky-600 bg-sky-50 text-sky-800 shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 pt-4">
      {loading && projects.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-sky-800" />
          Loading projects…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No projects match your search.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p) => {
            const subtitle =
              p.clientName || p.generalContractor || p.location || "—";
            return (
              <li key={p.id}>
                <Link
                  to={`/field/projects/${p.id}`}
                  className="block rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm transition active:scale-[0.99] hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <p className="break-words text-sm font-semibold leading-snug text-foreground">
                    {p.jobNumber} — {p.name}
                    {p.location ? ` — ${p.location}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {subtitle}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
