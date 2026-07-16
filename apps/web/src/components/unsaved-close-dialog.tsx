import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type UnsavedCloseDialogProps = {
  open: boolean;
  saving?: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

/** Confirm when closing a dirty create/edit form */
export function UnsavedCloseDialog({
  open,
  saving,
  onStay,
  onDiscard,
  onSave,
}: UnsavedCloseDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-close-title"
        className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-xl"
      >
        <h2
          id="unsaved-close-title"
          className="text-lg font-semibold tracking-tight"
        >
          Save changes?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You have unsaved changes. Do you want to save them before closing?
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onStay}>
            Keep editing
          </Button>
          <Button type="button" variant="outline" disabled={saving} onClick={onDiscard}>
            Discard
          </Button>
          <Button
            type="button"
            className="bg-asphalt-mid text-white hover:bg-asphalt"
            disabled={saving}
            onClick={onSave}
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

type ModalCloseButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export function ModalCloseButton({
  onClick,
  disabled,
  label = "Close",
}: ModalCloseButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <X className="size-4" />
    </Button>
  );
}
