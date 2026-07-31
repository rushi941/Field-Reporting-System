import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ModalOverlayProps = {
  open: boolean;
  children: ReactNode;
  className?: string;
  onBackdropClick?: () => void;
};

/** Full-viewport modal shell — portaled to body so page transforms don't break centering. */
export function ModalOverlay({
  open,
  children,
  className,
  onBackdropClick,
}: ModalOverlayProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "modal-overlay fixed inset-0 z-[4000] overflow-y-auto bg-black/45 p-4 sm:p-6",
        className,
      )}
      onClick={
        onBackdropClick
          ? (e) => {
              if (e.target === e.currentTarget) onBackdropClick();
            }
          : undefined
      }
    >
      <div className="flex min-h-full items-center justify-center py-4">
        {children}
      </div>
    </div>,
    document.body,
  );
}
