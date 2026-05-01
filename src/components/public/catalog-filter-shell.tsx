"use client";

import { ChevronDown, X, type LucideIcon } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";

const MOBILE_BREAKPOINT = 768;
const VIEWPORT_MARGIN = 12;
const DEFAULT_PANEL_WIDTH = 360;
const DEFAULT_PANEL_MAX_HEIGHT = 560;

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type PanelAlign = "start" | "end" | "center";

export type CatalogActiveFilterItem = {
  key: string;
  label: string;
  onClear: () => void;
};

type CatalogFilterShellProps = {
  chips: ReactNode;
  totalLabel: string;
  hasActiveFilters: boolean;
  onResetAll?: () => void;
  desktopAside?: ReactNode;
  mobileAside?: ReactNode;
  className?: string;
  sticky?: boolean;
};

type CatalogFilterChipButtonProps = {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  open?: boolean;
  onClick: () => void;
  onClear?: () => void;
  ariaControls?: string;
  compact?: boolean;
};

type ResponsiveFilterPanelProps = {
  open: boolean;
  title: string;
  trigger: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  align?: PanelAlign;
  maxHeight?: number;
  className?: string;
};

type CatalogFilterPanelActionsProps = {
  onApply: () => void;
  onClear?: () => void;
  applyLabel?: string;
  clearLabel?: string;
  resultLabel?: string | null;
};

type CatalogFieldGroupProps = {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }

  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return element.tabIndex >= 0;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function focusWithoutScroll(element: HTMLElement | null) {
  if (!element) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function useIsMobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = (matches: boolean) => setIsMobile(matches);

    update(mediaQuery.matches);

    const listener = (event: MediaQueryListEvent) => update(event.matches);
    mediaQuery.addEventListener("change", listener);

    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  return isMobile;
}

export function CatalogFilterShell({
  chips,
  totalLabel,
  hasActiveFilters,
  onResetAll,
  desktopAside,
  mobileAside,
  className,
  sticky = true,
}: CatalogFilterShellProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-visible border-b border-transparent bg-transparent before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-0 before:h-full before:bg-[linear-gradient(180deg,rgba(250,248,245,0.97)_0%,rgba(250,248,245,0.86)_38%,rgba(250,248,245,0.42)_68%,rgba(250,248,245,0)_100%)] before:backdrop-blur-md before:content-[''] md:border-olive/8 md:bg-cream/95 md:backdrop-blur-md md:before:hidden",
        sticky && "sticky top-[76px] z-[45] md:top-[88px]",
        className,
      )}
    >
      <div className="relative z-10 mx-auto w-full max-w-[1680px] px-4 py-0 md:px-6 md:py-3">
        <div className="rounded-[30px] border border-transparent bg-transparent p-0 shadow-none md:border-olive/10 md:bg-white/88 md:p-3 md:shadow-[0_18px_40px_-30px_rgba(15,74,64,0.34)] md:backdrop-blur-xl">
          <div className="flex touch-pan-x snap-x snap-mandatory gap-2 overflow-x-auto rounded-[28px] border border-transparent bg-white/75 px-2 py-2 shadow-[0_16px_34px_-28px_rgba(15,74,64,0.48)] backdrop-blur-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:px-0 md:py-0 md:shadow-none md:backdrop-blur-none">
            {chips}
          </div>
          <div className="mt-3 hidden items-center justify-between gap-3 border-t border-olive/10 pt-3 md:flex">
            <div className="min-w-0">
              {totalLabel ? (
                <span className="whitespace-nowrap text-sm font-semibold text-olive">
                  {totalLabel}
                </span>
              ) : null}
            </div>

            <div className="hidden shrink-0 items-center gap-3 md:flex">
              {desktopAside}
              {hasActiveFilters && onResetAll ? (
                <>
                  <div className="h-5 w-px bg-olive/12" />
                  <button
                    type="button"
                    onClick={onResetAll}
                    className="whitespace-nowrap text-sm font-semibold text-primary transition hover:text-primary/70"
                  >
                    Сбросить
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2 md:hidden">
              {mobileAside}
              {hasActiveFilters && onResetAll ? (
                <button
                  type="button"
                  onClick={onResetAll}
                  className="text-xs font-semibold text-primary transition hover:text-primary/70"
                >
                  Сбросить
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CatalogFilterChipButton({
  icon,
  label,
  active = false,
  open = false,
  onClick,
  onClear,
  ariaControls,
  compact = false,
}: CatalogFilterChipButtonProps) {
  const showClearButton = Boolean(onClear && active);

  return (
    <div className="relative shrink-0 snap-start">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-controls={ariaControls}
        className={cn(
          "group inline-flex items-center gap-3 rounded-[24px] border text-left transition-all duration-200",
          compact ? "min-h-10 px-3 py-2" : "min-h-[52px] px-3.5 py-2.5",
          showClearButton && "pr-11",
          open
            ? "border-primary/26 bg-white text-primary ring-2 ring-primary/12 shadow-[0_18px_38px_-26px_rgba(15,118,110,0.45)]"
            : active
              ? "border-primary/18 bg-[linear-gradient(180deg,rgba(15,118,110,0.11),rgba(15,118,110,0.03))] text-primary shadow-[0_16px_34px_-28px_rgba(15,118,110,0.42)]"
              : "border-white/80 bg-white/92 text-olive shadow-[0_14px_30px_-26px_rgba(15,74,64,0.34)] hover:border-olive/14 hover:bg-white hover:shadow-[0_18px_34px_-28px_rgba(15,74,64,0.44)]",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
            compact ? "h-8 w-8" : "h-9 w-9",
            open
              ? "bg-primary text-white"
              : active
                ? "bg-primary/12 text-primary"
                : "bg-cream/80 text-olive/70 group-hover:bg-cream group-hover:text-olive",
          )}
        >
          <AppIcon icon={icon} className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} />
        </span>

        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate font-semibold leading-tight",
              compact ? "max-w-[156px] text-sm" : "max-w-[182px] text-sm",
            )}
          >
            {label}
          </span>
        </span>

        {!showClearButton ? (
          <ChevronDown
            className={cn(
              "shrink-0 text-olive/45 transition-transform duration-200",
              compact ? "h-4 w-4" : "h-[18px] w-[18px]",
              open && "rotate-180 text-primary",
            )}
          />
        ) : null}
      </button>

      {showClearButton ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClear?.();
          }}
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-primary/12 text-primary transition hover:bg-primary hover:text-white"
          aria-label={`Сбросить ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function CatalogActiveFilters({
  title = "Активные",
  items,
  onResetAll,
  className,
}: {
  title?: string;
  items: CatalogActiveFilterItem[];
  onResetAll?: () => void;
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-olive/50">{title}:</span>
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
        >
          {item.label}
          <button
            type="button"
            onClick={item.onClear}
            className="rounded-full p-0.5 transition hover:bg-primary/20"
            aria-label={`Убрать фильтр ${item.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {onResetAll && items.length > 1 ? (
        <button
          type="button"
          onClick={onResetAll}
          className="text-xs text-olive/50 underline transition hover:text-olive"
        >
          Сбросить всё
        </button>
      ) : null}
    </div>
  );
}

export function CatalogFieldGroup({
  label,
  description,
  children,
  className,
}: CatalogFieldGroupProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-olive/50">{label}</p>
        {description ? <p className="mt-1 text-xs text-olive/55">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function CatalogFilterPanelActions({
  onApply,
  onClear,
  applyLabel = "Применить",
  clearLabel = "Сбросить",
  resultLabel = null,
}: CatalogFilterPanelActionsProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-olive/10 bg-white px-5 py-4">
      {resultLabel ? <p className="text-xs font-medium text-olive/55">{resultLabel}</p> : null}
      <div className="flex items-center gap-2">
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl border border-olive/16 bg-white px-4 text-sm font-semibold text-olive transition hover:bg-cream/70"
          >
            {clearLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onApply}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90"
        >
          {applyLabel}
        </button>
      </div>
    </div>
  );
}

export function ResponsiveFilterPanel({
  open,
  title,
  trigger,
  onClose,
  children,
  footer,
  width = DEFAULT_PANEL_WIDTH,
  align = "start",
  maxHeight = DEFAULT_PANEL_MAX_HEIGHT,
  className,
}: ResponsiveFilterPanelProps) {
  const isMobile = useIsMobileViewport();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({
    left: VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    width,
    maxHeight,
    opacity: 0,
    pointerEvents: "none",
  });
  const titleId = useId();
  const panelId = useId();
  const canPortal = typeof document !== "undefined";
  const shouldLockScroll = open && isMobile;

  useBodyScrollLock(shouldLockScroll);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const closePanel = useCallback(() => {
    onCloseRef.current();
  }, []);

  const updateDesktopPosition = useCallback(() => {
    if (!open || isMobile || !anchorRef.current || !panelRef.current) {
      return;
    }

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const nextWidth = Math.min(width, viewportWidth - VIEWPORT_MARGIN * 2);
    const nextMaxHeight = Math.min(maxHeight, viewportHeight - VIEWPORT_MARGIN * 2);
    const visibleHeight = Math.min(panelRect.height || nextMaxHeight, nextMaxHeight);

    let left = anchorRect.left;
    if (align === "end") {
      left = anchorRect.right - nextWidth;
    } else if (align === "center") {
      left = anchorRect.left + (anchorRect.width - nextWidth) / 2;
    }
    left = clamp(left, VIEWPORT_MARGIN, viewportWidth - nextWidth - VIEWPORT_MARGIN);

    const belowTop = anchorRect.bottom + 8;
    const aboveTop = anchorRect.top - visibleHeight - 8;
    let top = belowTop;

    if (belowTop + visibleHeight > viewportHeight - VIEWPORT_MARGIN) {
      top =
        aboveTop >= VIEWPORT_MARGIN
          ? aboveTop
          : clamp(
              anchorRect.top + (anchorRect.height - visibleHeight) / 2,
              VIEWPORT_MARGIN,
              viewportHeight - visibleHeight - VIEWPORT_MARGIN,
            );
    }

    setPanelStyle({
      left,
      top,
      width: nextWidth,
      maxHeight: nextMaxHeight,
      opacity: 1,
      pointerEvents: "auto",
    });
  }, [align, isMobile, maxHeight, open, width]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      updateDesktopPosition();
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [updateDesktopPosition, children, footer]);

  useEffect(() => {
    if (!open || isMobile) {
      return;
    }

    const handleResize = () => updateDesktopPosition();
    const handleScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && (panelRef.current?.contains(target) || anchorRef.current?.contains(target))) {
        return;
      }

      closePanel();
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [closePanel, isMobile, open, updateDesktopPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const root = panelRef.current;
    const focusElements = getFocusableElements(root);
    const firstFocusable = focusElements[0] ?? root;

    const focusTimer = window.setTimeout(() => {
      focusWithoutScroll(firstFocusable);
    }, 0);

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }

      closePanel();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const elements = getFocusableElements(panelRef.current);
      if (elements.length === 0) {
        event.preventDefault();
        focusWithoutScroll(panelRef.current);
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || activeElement === panelRef.current) {
          event.preventDefault();
          focusWithoutScroll(last);
        }
        return;
      }

      if (activeElement === last) {
        event.preventDefault();
        focusWithoutScroll(first);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      focusWithoutScroll(previousFocusedRef.current);
    };
  }, [closePanel, isMobile, open]);

  const desktopLayer = useMemo(() => {
    if (!open || isMobile) {
      return null;
    }

    return (
      <div
        id={panelId}
        ref={panelRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fixed z-[80] flex flex-col overflow-hidden rounded-[28px] border border-olive/12 bg-white shadow-[0_28px_64px_-32px_rgba(15,74,64,0.38)]"
        style={panelStyle}
      >
        <div className="flex items-center justify-between gap-3 border-b border-olive/10 px-5 py-4">
          <h3 id={titleId} className="text-base font-semibold text-olive">
            {title}
          </h3>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-2xl p-2 text-olive/60 transition hover:bg-cream"
            aria-label="Закрыть"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer}
      </div>
    );
  }, [children, closePanel, footer, isMobile, open, panelId, panelStyle, title, titleId]);

  const mobileLayer = useMemo(() => {
    if (!open || !isMobile) {
      return null;
    }

    return (
      <div className="fixed inset-0 z-[90]">
        <button
          type="button"
          onClick={closePanel}
          aria-label="Закрыть"
          className="absolute inset-0 bg-midnight/40 backdrop-blur-[1px]"
        />
        <section
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-18px_44px_-24px_rgba(15,74,64,0.4)]"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <div className="shrink-0 border-b border-olive/10 px-5 pb-3 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-olive/18" />
            <div className="flex items-center justify-between gap-3">
              <h3 id={titleId} className="text-base font-semibold text-olive">
                {title}
              </h3>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-2xl p-2 text-olive/60 transition hover:bg-cream"
                aria-label="Закрыть"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer}
        </section>
      </div>
    );
  }, [children, closePanel, footer, isMobile, open, panelId, title, titleId]);

  return (
    <div ref={anchorRef} className={cn("relative shrink-0", className)}>
      {trigger}
      {canPortal ? createPortal(isMobile ? mobileLayer : desktopLayer, document.body) : null}
    </div>
  );
}
