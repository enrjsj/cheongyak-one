// Escape 닫기와 최초 포커스를 공통 처리해 모달의 키보드 접근성을 보장한다.
import { RefObject, useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const dialogStack: HTMLElement[] = [];
let unlockedOverflow = "";

export function useDialogAccessibility<T extends HTMLElement>(open: boolean, onClose: () => void): RefObject<T | null> {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const wasOpen = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  if (open && !wasOpen.current) opener.current = typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wasOpen.current = open;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = opener.current;
    if (dialogStack.length === 0) unlockedOverflow = document.body.style.overflow;
    dialogStack.push(dialog);
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      if (dialogStack.at(-1) !== dialog) return;
      const first = dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (first ?? dialog)?.focus();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== dialog || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)]
        .filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      const wasTop = dialogStack.at(-1) === dialog;
      const index = dialogStack.indexOf(dialog);
      if (index >= 0) dialogStack.splice(index, 1);
      document.body.style.overflow = dialogStack.length ? "hidden" : unlockedOverflow;
      if (wasTop) {
        const parent = dialogStack.at(-1);
        if (previouslyFocused?.isConnected && !previouslyFocused.matches(":disabled") && (!parent || parent.contains(previouslyFocused))) previouslyFocused.focus();
        else parent?.focus();
      }
    };
  }, [open]);

  return dialogRef;
}
