import { useEffect, useRef, type ReactNode } from "react";

/** Native <dialog> shown as a modal while `open` is true. Esc closes it. */
export function Dialog({
  open,
  onClose,
  id,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  id?: string;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute("open", "");
      }
    } else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      id={id}
      aria-label={label}
      onClose={onClose}
    >
      {open && children}
    </dialog>
  );
}
