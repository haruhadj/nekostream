"use client";

import { useEffect, useRef } from "react";

/**
 * A modal that is a bottom sheet on a phone and a centred dialog from sm up.
 *
 * The two dialogs in the app each implemented this separately and ended up
 * behaving differently: both closed on Escape and on a backdrop click, but only
 * one locked the page behind it, so the other let the background scroll under
 * the user's finger. The behaviour lives here now, and callers supply only the
 * panel's own sizing and layout.
 */
export function Sheet({
  label,
  onClose,
  panelClassName,
  children,
}: {
  /** Names the dialog for screen readers. */
  label: string;
  onClose: () => void;
  panelClassName: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKey);

    // Focus moves into the panel so keyboard users are not left behind on the
    // page underneath.
    panelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`outline-none ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

/** The affordance that says "swipe or tap away". Phone only. */
export function SheetGrabHandle() {
  return (
    <span
      aria-hidden="true"
      className="mx-auto -mt-1 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
    />
  );
}
