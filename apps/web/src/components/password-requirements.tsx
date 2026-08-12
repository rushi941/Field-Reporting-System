import { Check, Circle } from "lucide-react";
import {
  getPasswordRequirementStatus,
  PASSWORD_REQUIREMENTS,
} from "@frs/shared";
import { cn } from "@/lib/utils";

type PasswordRequirementsProps = {
  password?: string;
  /** checklist: live met/unmet; info: static list for login */
  variant?: "checklist" | "info";
  className?: string;
};

export function PasswordRequirements({
  password = "",
  variant = "checklist",
  className,
}: PasswordRequirementsProps) {
  const items =
    variant === "info"
      ? PASSWORD_REQUIREMENTS
      : getPasswordRequirementStatus(password);

  return (
    <ul
      className={cn(
        "grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2",
        className,
      )}
    >
      {items.map((item) => {
        const met = "met" in item ? item.met : undefined;
        return (
          <li key={item.id} className="flex items-start gap-2">
            {variant === "checklist" ? (
              met ? (
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-emerald-600"
                  aria-hidden
                />
              ) : (
                <Circle
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden
                />
              )
            ) : (
              <span className="mt-0.5 shrink-0" aria-hidden>
                •
              </span>
            )}
            <span
              className={cn(
                variant === "checklist" && met && "text-emerald-700 dark:text-emerald-500",
              )}
            >
              {item.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
