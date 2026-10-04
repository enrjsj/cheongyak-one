import { useEffect, useRef } from "react";
import type { KeyboardEvent, FocusEvent } from "react";

// Reveal within the tab strip only: never scroll the whole page on selection.
export function useHorizontalTabs(selection: string, open = true) {
  const ref = useRef<HTMLDivElement>(null);
  const reveal = (element: HTMLElement) => {
    const container = ref.current;
    if (!container || !container.contains(element)) return;
    const outer = container.getBoundingClientRect();
    const inner = element.getBoundingClientRect();
    if (inner.left < outer.left + 4) container.scrollLeft += inner.left - outer.left - 4;
    else if (inner.right > outer.right - 4) container.scrollLeft += inner.right - outer.right + 4;
  };
  useEffect(() => {
    if (!open || !ref.current) return;
    const container = ref.current;
    const update = () => {
      const active = container.querySelector<HTMLElement>('[aria-selected="true"]');
      if (active) reveal(active);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    container.querySelectorAll('[role="tab"]').forEach(tab => observer.observe(tab));
    return () => observer.disconnect();
  }, [selection, open]);
  const onFocusCapture = (event: FocusEvent<HTMLDivElement>) => {
    const tab = (event.target as HTMLElement).closest<HTMLElement>('[role="tab"]');
    if (tab) reveal(tab);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || !tabs.length) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus({ preventScroll: true });
    tabs[next].click();
  };
  return { ref, onFocusCapture, onKeyDown };
}
