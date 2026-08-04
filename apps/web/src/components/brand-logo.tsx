import { cn } from "@/lib/utils";

const BRAND = {
  full: "/brand/atc-logo-full.png",
  compact: "/brand/atc-logo-compact.png",
  mark: "/brand/atc-logo-mark.png",
} as const;

type BrandLogoVariant = keyof typeof BRAND;

type BrandLogoProps = {
  variant?: BrandLogoVariant;
  className?: string;
  imgClassName?: string;
  subtitle?: string;
  subtitleClassName?: string;
  onLight?: boolean;
  onDark?: boolean;
};

const variantHeights: Record<BrandLogoVariant, string> = {
  full: "h-8 sm:h-9",
  compact: "h-7 sm:h-8",
  mark: "h-8 w-8 sm:h-9 sm:w-9",
};

/** Compact sidebar header: mark + role label — fits narrow sidebars cleanly. */
export function SidebarBrand({
  roleLabel,
  className,
}: {
  roleLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-asphalt ring-1 ring-white/10">
        <img
          src={BRAND.mark}
          alt=""
          aria-hidden
          className="size-10 object-cover"
        />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[13px] font-semibold tracking-tight text-white">
          Advanced Traffic
        </p>
        <p className="truncate text-[11px] font-medium text-lane">{roleLabel}</p>
      </div>
    </div>
  );
}

export function BrandLogo({
  variant = "full",
  className,
  imgClassName,
  subtitle,
  subtitleClassName,
  onLight = false,
  onDark = false,
}: BrandLogoProps) {
  const src = BRAND[variant];
  const isMark = variant === "mark";

  return (
    <div className={cn("min-w-0", subtitle ? "space-y-2" : undefined, className)}>
      <img
        src={src}
        alt="Advanced Traffic Control"
        className={cn(
          "w-auto object-contain object-left",
          variantHeights[variant],
          isMark && "rounded-sm",
          onDark && "brightness-0 invert",
          imgClassName,
        )}
      />
      {subtitle ? (
        <p
          className={cn(
            "truncate text-[11px] font-medium",
            onLight ? "text-muted-foreground" : "text-steel",
            subtitleClassName,
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
