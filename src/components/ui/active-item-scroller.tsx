"use client";

import { useEffect } from "react";

type ActiveItemScrollerProps = {
  rootId: string;
  activeKey?: string;
  activeSelector?: string;
  breakpointPx?: number;
};

export function ActiveItemScroller({
  rootId,
  activeKey,
  activeSelector = "[data-active='true']",
  breakpointPx = 1024,
}: ActiveItemScrollerProps) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || window.matchMedia(`(min-width: ${breakpointPx}px)`).matches) {
      return;
    }

    const activeItem = root.querySelector<HTMLElement>(activeSelector);
    if (!activeItem) {
      return;
    }

    window.requestAnimationFrame(() => {
      activeItem.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "auto",
      });
    });
  }, [activeKey, activeSelector, breakpointPx, rootId]);

  return null;
}
