"use client";

// Client hook that toggles the sticky public search bar based on scroll direction and offset.
import { useEffect, useRef, useState } from "react";

export function useStickySearch() {
  const [visible, setVisible] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHasScrolled(y > 12);

      if (y <= 80) {
        setVisible(false);
        lastY.current = y;
        return;
      }

      if (y < lastY.current) {
        setVisible(true);
      } else if (y > lastY.current) {
        setVisible(false);
      }

      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return {
    visible,
    hasScrolled,
  };
}
