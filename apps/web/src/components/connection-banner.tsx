import { Loader2, WifiOff } from "lucide-react";
import { formatCacheAge } from "@/lib/offline-cache";
import { cn } from "@/lib/utils";

type ConnectionBannerProps = {
  online: boolean;
  fromCache: boolean;
  refreshing?: boolean;
  cacheSavedAt?: number | null;
  error?: string | null;
  className?: string;
};

export function ConnectionBanner({
  online,
  fromCache,
  refreshing,
  cacheSavedAt,
  error,
  className,
}: ConnectionBannerProps) {
  if (!fromCache && online && !refreshing && !error) return null;

  let message = "";
  if (!online) {
    message = fromCache
      ? `Offline — showing saved data${cacheSavedAt ? ` from ${formatCacheAge(cacheSavedAt)}` : ""}.`
      : "You appear to be offline.";
  } else if (refreshing && fromCache) {
    message = "Slow connection — showing saved data while updating…";
  } else if (fromCache && cacheSavedAt) {
    message = `Showing saved data from ${formatCacheAge(cacheSavedAt)}. Updating…`;
  } else if (error && fromCache) {
    message = `Could not refresh — showing saved data (${error}).`;
  } else if (error) {
    message = error;
  } else if (refreshing) {
    message = "Updating…";
  }

  if (!message) return null;

  const isError = Boolean(error) && !fromCache;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs leading-relaxed",
        isError
          ? "border-destructive/30 bg-destructive/10 text-destructive"
          : "border-amber-300/60 bg-amber-50 text-amber-950",
        className,
      )}
      role="status"
    >
      {!online ? (
        <WifiOff className="mt-0.5 size-4 shrink-0" />
      ) : refreshing ? (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
      ) : null}
      <span>{message}</span>
    </div>
  );
}
