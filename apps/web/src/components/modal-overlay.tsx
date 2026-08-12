import { type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/use-scroll-lock";
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
  useScrollLock(open);

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        "modal-overlay fixed inset-0 z-[4000] overflow-hidden overscroll-none bg-black/45 p-4 sm:p-6",
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
      <div className="flex h-full items-center justify-center overflow-y-auto overscroll-contain py-4">
        {children}
      </div>
    </div>,
    document.body,
  );
}
