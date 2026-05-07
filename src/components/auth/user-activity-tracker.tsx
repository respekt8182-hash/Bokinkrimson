"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { USER_ACTIVITY_HEARTBEAT_INTERVAL_MS } from "@/lib/user-activity-constants";

const storageKey = "boking:last-user-activity-heartbeat";
const clientThrottleMs = 60 * 1000;

function readLastHeartbeatAt(): number {
  try {
    return Number(window.localStorage.getItem(storageKey) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function writeLastHeartbeatAt(value: number) {
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    // localStorage can be blocked; the server-side throttle still protects the DB.
  }
}

export function UserActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    let isDisposed = false;

    async function sendHeartbeat(force = false) {
      if (isDisposed || document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();
      if (!force && now - readLastHeartbeatAt() < clientThrottleMs) {
        return;
      }

      writeLastHeartbeatAt(now);

      try {
        await fetch("/api/auth/activity", {
          method: "POST",
          credentials: "same-origin",
          keepalive: true,
        });
      } catch {
        // Activity tracking is intentionally best-effort.
      }
    }

    void sendHeartbeat();

    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, USER_ACTIVITY_HEARTBEAT_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void sendHeartbeat(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pathname]);

  return null;
}
