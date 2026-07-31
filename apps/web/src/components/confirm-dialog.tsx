import { type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Centered confirm dialog — portaled above modals (z 4000). */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[4000] flex items-center justify-center bg-black/45 p-4"
      onClick={busy ? undefined : onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="text-base font-semibold tracking-tight"
        >
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">{description}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className={
              destructive ? undefined : "bg-asphalt-mid text-white hover:bg-asphalt"
            }
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Working…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
