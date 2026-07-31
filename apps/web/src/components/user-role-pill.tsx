import { type AppRole, isAppRole, roleLabels } from "@frs/shared";
import { cn } from "@/lib/utils";

const roleStyles: Record<
  AppRole,
  { light: string; dark: string }
> = {
  FIELD_LEAD: {
    light: "bg-sky-100 text-sky-900 ring-sky-200",
    dark: "bg-sky-500/20 text-sky-100 ring-sky-400/35",
  },
  DIVISION_MANAGER: {
    light: "bg-violet-100 text-violet-900 ring-violet-200",
    dark: "bg-violet-500/20 text-violet-100 ring-violet-400/35",
  },
  PROJECT_ADMIN: {
    light: "bg-amber-100 text-amber-950 ring-amber-200",
    dark: "bg-amber-500/20 text-amber-100 ring-amber-400/35",
  },
  SYSTEM_ADMIN: {
    light: "bg-slate-200 text-slate-900 ring-slate-300",
    dark: "bg-white/15 text-slate-100 ring-white/20",
  },
};

type UserRolePillProps = {
  role: AppRole | string;
  variant?: "light" | "dark";
  className?: string;
};

export function UserRolePill({
  role,
  variant = "light",
  className,
}: UserRolePillProps) {
  if (!isAppRole(role)) return null;
  const styles = roleStyles[role][variant];
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset",
        styles,
        className,
      )}
    >
      {roleLabels[role]}
    </span>
  );
}

type UserHeaderIdentityProps = {
  name: string;
  role: AppRole | string;
  compact?: boolean;
  subtitle?: boolean;
  className?: string;
};

/** Name + role pill for mobile/desktop app headers */
export function UserHeaderIdentity({
  name,
  role,
  compact,
  subtitle,
  className,
}: UserHeaderIdentityProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex flex-wrap items-center gap-1.5">
        <p
          className={cn(
            "truncate",
            subtitle
              ? "text-[11px] text-muted-foreground"
              : cn(
                  "font-semibold text-foreground",
                  compact ? "text-sm" : "text-sm lg:text-base",
                ),
          )}
        >
          {name}
        </p>
        <UserRolePill role={role} />
      </div>
    </div>
  );
}
