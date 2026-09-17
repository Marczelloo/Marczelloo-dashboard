"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

export interface IndicatorRect {
  left: number;
  width: number;
}

/**
 * Tracks the position of the active child inside `container` (for a sliding tab
 * or segment indicator). Re-measures on resize and when state attributes change.
 */
export function useIndicator(container: RefObject<HTMLElement | null>, activeSelector: string): IndicatorRect | null {
  const [rect, setRect] = useState<IndicatorRect | null>(null);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const active = root.querySelector<HTMLElement>(activeSelector);
      setRect((previous) => {
        if (!active) return null;
        const next = { left: active.offsetLeft, width: active.offsetWidth };
        return previous && previous.left === next.left && previous.width === next.width ? previous : next;
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    const mutations = new MutationObserver(measure);
    mutations.observe(root, { subtree: true, attributes: true, attributeFilter: ["data-state", "data-active"] });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [container, activeSelector]);

  return rect;
}
