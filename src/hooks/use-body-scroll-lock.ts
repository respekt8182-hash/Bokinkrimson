"use client";

import { useEffect } from "react";

let activeLocks = 0;
let originalOverflow = "";
let originalPaddingRight = "";
let originalOverscrollBehavior = "";

function getScrollbarWidth(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
}

function applyBodyScrollLock() {
  if (typeof document === "undefined") {
    return;
  }

  const body = document.body;
  const computedStyles = window.getComputedStyle(body);
  const currentPaddingRight = Number.parseFloat(computedStyles.paddingRight) || 0;
  const scrollbarWidth = getScrollbarWidth();

  originalOverflow = body.style.overflow;
  originalPaddingRight = body.style.paddingRight;
  originalOverscrollBehavior = body.style.overscrollBehavior;

  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }

  body.style.overflow = "hidden";
  body.style.overscrollBehavior = "contain";
}

function releaseBodyScrollLock() {
  if (typeof document === "undefined") {
    return;
  }

  const body = document.body;
  body.style.overflow = originalOverflow;
  body.style.paddingRight = originalPaddingRight;
  body.style.overscrollBehavior = originalOverscrollBehavior;
}

export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }

  if (activeLocks === 0) {
    applyBodyScrollLock();
  }

  activeLocks += 1;

  return () => {
    activeLocks = Math.max(0, activeLocks - 1);

    if (activeLocks === 0) {
      releaseBodyScrollLock();
    }
  };
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) {
      return;
    }

    return lockBodyScroll();
  }, [active]);
}
