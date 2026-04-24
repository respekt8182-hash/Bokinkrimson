"use client";

import { useEffect, useState } from "react";

function readVisibilityState() {
  if (typeof document === "undefined") {
    return true;
  }

  return !document.hidden;
}

export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(readVisibilityState);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const syncVisibility = () => {
      setIsVisible(!document.hidden);
    };

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("focus", syncVisibility);
    window.addEventListener("blur", syncVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("focus", syncVisibility);
      window.removeEventListener("blur", syncVisibility);
    };
  }, []);

  return isVisible;
}
