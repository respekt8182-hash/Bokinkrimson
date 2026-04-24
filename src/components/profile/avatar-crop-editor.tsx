"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";

const MIN_CROP_PX = 60;
const HANDLE_PX = 24; // bigger for touch

export type CropRotation = 0 | 90 | 180 | 270;

export interface CropParams {
  imageX: number;
  imageY: number;
  imageSize: number;
  rotation: CropRotation;
}

interface Layout {
  scale: number;
  displayW: number;
  displayH: number;
  offsetX: number;
  offsetY: number;
}

function makeLayout(nw: number, nh: number, rotation: CropRotation, stageW: number, stageH: number): Layout {
  const rw = rotation % 180 !== 0 ? nh : nw;
  const rh = rotation % 180 !== 0 ? nw : nh;
  const scale = Math.min(stageW / rw, stageH / rh);
  const displayW = rw * scale;
  const displayH = rh * scale;
  return {
    scale,
    displayW,
    displayH,
    offsetX: (stageW - displayW) / 2,
    offsetY: (stageH - displayH) / 2,
  };
}

interface CropBox {
  x: number;
  y: number;
  size: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function clampCrop(c: CropBox, l: Layout): CropBox {
  const maxSz = Math.min(l.displayW, l.displayH);
  const size = clamp(c.size, MIN_CROP_PX, maxSz);
  return {
    x: clamp(c.x, l.offsetX, l.offsetX + l.displayW - size),
    y: clamp(c.y, l.offsetY, l.offsetY + l.displayH - size),
    size,
  };
}

function initCrop(l: Layout): CropBox {
  const size = Math.min(l.displayW, l.displayH) * 0.75;
  return {
    x: l.offsetX + (l.displayW - size) / 2,
    y: l.offsetY + (l.displayH - size) / 2,
    size,
  };
}

type Corner = "nw" | "ne" | "sw" | "se";

type Drag =
  | { mode: "move"; px0: number; py0: number; cx0: number; cy0: number }
  | { mode: "resize"; corner: Corner; fx: number; fy: number };

interface Props {
  imageUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  onConfirm: (params: CropParams) => void;
  onCancel: () => void;
}

export function AvatarCropEditor({
  imageUrl,
  naturalWidth,
  naturalHeight,
  onConfirm,
  onCancel,
}: Props) {
  const [rotation, setRotation] = useState<CropRotation>(0);
  const [stageSize, setStageSize] = useState({ w: 500, h: 340 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Measure container on mount and resize
  useEffect(() => {
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      // container has p-4 (16px) on mobile, p-6 (24px) on sm+
      // the modal itself has p-4 sm:p-6 padding
      const availableW = el.clientWidth;
      const w = Math.min(availableW, 500);
      const h = Math.round(w * 0.68); // keep ~500:340 ratio
      setStageSize({ w, h });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const layout = makeLayout(naturalWidth, naturalHeight, rotation, stageSize.w, stageSize.h);
  const layoutRef = useRef<Layout>(layout);

  const [crop, setCrop] = useState<CropBox>(() =>
    initCrop(makeLayout(naturalWidth, naturalHeight, 0, stageSize.w, stageSize.h)),
  );

  // Re-center crop when stage size changes
  const prevStageSizeRef = useRef(stageSize);
  useEffect(() => {
    const prev = prevStageSizeRef.current;
    if (prev.w !== stageSize.w || prev.h !== stageSize.h) {
      prevStageSizeRef.current = stageSize;
      const newLayout = makeLayout(naturalWidth, naturalHeight, rotation, stageSize.w, stageSize.h);
      const frameId = window.requestAnimationFrame(() => {
        setCrop(initCrop(newLayout));
      });

      return () => window.cancelAnimationFrame(frameId);
    }
  }, [stageSize, naturalWidth, naturalHeight, rotation]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
    const l = layoutRef.current;

    if (drag.mode === "move") {
      setCrop((c) =>
        clampCrop(
          { x: drag.cx0 + pt.x - drag.px0, y: drag.cy0 + pt.y - drag.py0, size: c.size },
          l,
        ),
      );
    } else {
      const { corner, fx, fy } = drag;
      let nc: CropBox;
      if (corner === "se") {
        const sz = Math.max(pt.x - fx, pt.y - fy, MIN_CROP_PX);
        nc = { x: fx, y: fy, size: sz };
      } else if (corner === "nw") {
        const sz = Math.max(fx - pt.x, fy - pt.y, MIN_CROP_PX);
        nc = { x: fx - sz, y: fy - sz, size: sz };
      } else if (corner === "ne") {
        const sz = Math.max(pt.x - fx, fy - pt.y, MIN_CROP_PX);
        nc = { x: fx, y: fy - sz, size: sz };
      } else {
        // sw
        const sz = Math.max(fx - pt.x, pt.y - fy, MIN_CROP_PX);
        nc = { x: fx - sz, y: fy, size: sz };
      }
      setCrop(clampCrop(nc, l));
    }
  }, []);

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Image CSS styles for CSS rotation trick
  const imgStyle: React.CSSProperties =
    rotation % 180 === 0
      ? {
          position: "absolute",
          left: 0,
          top: 0,
          width: layout.displayW,
          height: layout.displayH,
          transform: rotation === 180 ? "rotate(180deg)" : "none",
          userSelect: "none",
        }
      : {
          position: "absolute",
          width: layout.displayH,
          height: layout.displayW,
          left: (layout.displayW - layout.displayH) / 2,
          top: (layout.displayH - layout.displayW) / 2,
          transform: `rotate(${rotation}deg)`,
          userSelect: "none",
        };

  const c = crop;

  function startMove(e: React.PointerEvent) {
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top };
    dragRef.current = { mode: "move", px0: pt.x, py0: pt.y, cx0: c.x, cy0: c.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function startResize(corner: Corner) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      const fixedCorners: Record<Corner, { fx: number; fy: number }> = {
        nw: { fx: c.x + c.size, fy: c.y + c.size },
        ne: { fx: c.x, fy: c.y + c.size },
        sw: { fx: c.x + c.size, fy: c.y },
        se: { fx: c.x, fy: c.y },
      };
      dragRef.current = { mode: "resize", corner, ...fixedCorners[corner] };
      (e.target as Element).setPointerCapture(e.pointerId);
    };
  }

  function handleConfirm() {
    const l = layoutRef.current;
    onConfirm({
      imageX: (c.x - l.offsetX) / l.scale,
      imageY: (c.y - l.offsetY) / l.scale,
      imageSize: c.size / l.scale,
      rotation,
    });
  }

  function rotateClockwise() {
    const nextRotation = ((rotation + 90) % 360) as CropRotation;
    const nextLayout = makeLayout(naturalWidth, naturalHeight, nextRotation, stageSize.w, stageSize.h);
    layoutRef.current = nextLayout;
    setRotation(nextRotation);
    setCrop(initCrop(nextLayout));
  }

  const corners: Array<{ corner: Corner; x: number; y: number; cursor: string }> = [
    { corner: "nw", x: c.x - HANDLE_PX / 2, y: c.y - HANDLE_PX / 2, cursor: "nwse-resize" },
    {
      corner: "ne",
      x: c.x + c.size - HANDLE_PX / 2,
      y: c.y - HANDLE_PX / 2,
      cursor: "nesw-resize",
    },
    {
      corner: "sw",
      x: c.x - HANDLE_PX / 2,
      y: c.y + c.size - HANDLE_PX / 2,
      cursor: "nesw-resize",
    },
    {
      corner: "se",
      x: c.x + c.size - HANDLE_PX / 2,
      y: c.y + c.size - HANDLE_PX / 2,
      cursor: "nwse-resize",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4"
      onClick={onCancel}
    >
      <div
        ref={containerRef}
        className="flex w-full max-w-[548px] flex-col gap-3 rounded-2xl bg-white p-4 shadow-2xl sm:gap-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-olive">Выбор области фото</h2>

        {/* Stage */}
        <div
          ref={stageRef}
          className="relative mx-auto overflow-hidden rounded-xl bg-neutral-900"
          style={{ width: stageSize.w, height: stageSize.h, userSelect: "none", touchAction: "none" }}
        >
          {/* Image */}
          <div
            className="overflow-hidden"
            style={{
              position: "absolute",
              left: layout.offsetX,
              top: layout.offsetY,
              width: layout.displayW,
              height: layout.displayH,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="" style={imgStyle} draggable={false} />
          </div>

          {/* Crop box — box-shadow creates the dark overlay outside the crop */}
          <div
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              width: c.size,
              height: c.size,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              border: "2px solid rgba(255,255,255,0.85)",
              boxSizing: "border-box",
              cursor: "move",
              touchAction: "none",
            }}
            onPointerDown={startMove}
          />

          {/* Corner resize handles */}
          {corners.map(({ corner, x, y, cursor }) => (
            <div
              key={corner}
              className="absolute z-10 rounded-full bg-white shadow-md"
              style={{
                left: x,
                top: y,
                width: HANDLE_PX,
                height: HANDLE_PX,
                cursor,
                touchAction: "none",
              }}
              onPointerDown={startResize(corner)}
            />
          ))}

          {/* Rotate button — top-right corner */}
          <button
            type="button"
            className="icon-button-soft absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-xl"
            title="Повернуть на 90°"
            onClick={rotateClockwise}
          >
            <AppIcon icon={RotateCw} className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <Button variant="ghost" onClick={onCancel} className="text-sm sm:text-base">
            Назад
          </Button>
          <Button onClick={handleConfirm} className="text-sm sm:text-base">
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
