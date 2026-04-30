const PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_KEY = "publicMobileBottomNavHidden";

export const PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_EVENT =
  "public-mobile-bottom-nav-hidden-change";
export const PUBLIC_MOBILE_BOTTOM_NAV_PROGRESS_EVENT =
  "public-mobile-bottom-nav-progress-change";

export type PublicMobileBottomNavProgressDetail = {
  progress: number;
};

const hiddenReasons = new Set<string>();

export function isPublicMobileBottomNavForceHidden(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  return document.documentElement.dataset[PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_KEY] === "true";
}

export function setPublicMobileBottomNavForceHidden(reason: string, hidden: boolean) {
  if (typeof document === "undefined") {
    return;
  }

  if (hidden) {
    hiddenReasons.add(reason);
  } else {
    hiddenReasons.delete(reason);
  }

  const nextHidden = hiddenReasons.size > 0;
  document.documentElement.dataset[PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_KEY] = String(nextHidden);
  window.dispatchEvent(new Event(PUBLIC_MOBILE_BOTTOM_NAV_HIDDEN_EVENT));
}

export function setPublicMobileBottomNavProgress(progress: number) {
  if (typeof window === "undefined") {
    return;
  }

  const nextProgress = Math.max(0, Math.min(1, Math.round(progress * 1000) / 1000));
  window.dispatchEvent(
    new CustomEvent<PublicMobileBottomNavProgressDetail>(
      PUBLIC_MOBILE_BOTTOM_NAV_PROGRESS_EVENT,
      { detail: { progress: nextProgress } },
    ),
  );
}
