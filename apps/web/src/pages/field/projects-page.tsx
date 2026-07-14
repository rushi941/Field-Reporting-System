import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
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
  const [projects, setProjects] = useState<FieldProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [division, setDivision] = useState<DivisionFilter>("ALL");

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetch<{ projects: FieldProject[] }>(
          "/api/v1/field/projects",
        );
        setProjects(data.projects);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
    <div className="space-y-4">
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

      <div className="flex gap-2 overflow-x-auto pb-1">
        {divisionChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => setDivision(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              division === chip.value
                ? "border-sky-600 bg-sky-50 text-sky-800"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-sky-800" />
          Loading projects…
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
          No projects match your search.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((p) => {
            const subtitle =
              p.clientName || p.generalContractor || p.location || "—";
            return (
              <li key={p.id}>
                <Link
                  to={`/field/projects/${p.id}`}
                  className="block rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/40"
                >
                  <p className="text-sm font-semibold leading-snug text-foreground">
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
  );
}
