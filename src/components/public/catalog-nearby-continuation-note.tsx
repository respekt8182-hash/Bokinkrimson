import { MapPin } from "lucide-react";
import { AppIcon } from "@/components/ui/app-icon";
import { cn } from "@/lib/cn";
import { NEARBY_CATALOG_RADIUS_KM } from "@/lib/catalog-radius";

type CatalogNearbyContinuationNoteProps = {
  locationName: string | null | undefined;
  radiusKm: number | null | undefined;
  className?: string;
};

export function CatalogNearbyContinuationNote({
  locationName,
  radiusKm,
  className,
}: CatalogNearbyContinuationNoteProps) {
  const location = locationName?.trim();
  const radius =
    typeof radiusKm === "number" && Number.isFinite(radiusKm)
      ? radiusKm
      : NEARBY_CATALOG_RADIUS_KM;
  const prefix = location
    ? `Предложения для «${location}» закончились`
    : "Предложения в выбранной локации закончились";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,rgba(15,118,110,0.1),rgba(255,255,255,0.95)_48%,rgba(232,98,26,0.08))] p-4 text-olive shadow-[0_16px_34px_-28px_rgba(15,74,64,0.55)]",
        className,
      )}
    >
      <div className="absolute -right-8 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-primary shadow-sm ring-1 ring-primary/12">
          <AppIcon icon={MapPin} className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-bold">Дальше показываем варианты рядом</p>
          <p className="mt-1 text-xs leading-5 text-olive/62">
            {prefix}, поэтому добавили соседние локации до {radius} км.
          </p>
        </div>
      </div>
    </div>
  );
}
