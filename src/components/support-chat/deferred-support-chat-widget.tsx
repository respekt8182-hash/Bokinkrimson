"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const SupportChatWidget = dynamic(
  () =>
    import("./support-chat-widget").then((m) => ({
      default: m.SupportChatWidget,
    })),
  { ssr: false },
);

export function DeferredSupportChatWidget() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    function activate() {
      if (mounted) setReady(true);
    }

    // Load after interaction or after 1.5s timeout
    const events = ["pointerdown", "keydown"] as const;
    const handler = () => {
      cleanup();
      activate();
    };

    for (const ev of events) {
      window.addEventListener(ev, handler, { once: true, passive: true });
    }

    const timer = setTimeout(() => {
      if ("requestIdleCallback" in window) {
        (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(activate);
      } else {
        activate();
      }
    }, 1500);

    function cleanup() {
      clearTimeout(timer);
      for (const ev of events) {
        window.removeEventListener(ev, handler);
      }
    }

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  if (!ready) return null;

  return <SupportChatWidget />;
}
