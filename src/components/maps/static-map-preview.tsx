import { cn } from "@/lib/cn";

type StaticMapPreviewProps = {
  latitude: number;
  longitude: number;
  label: string;
  className?: string;
  mapClassName?: string;
  zoom?: number;
};

export function StaticMapPreview({
  latitude,
  longitude,
  label,
  className,
  mapClassName,
  zoom = 13,
}: StaticMapPreviewProps) {
  const mapUrl = `https://yandex.ru/map-widget/v1/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude},pm2rdm&z=${zoom}`;
  const externalUrl = `https://yandex.ru/maps/?ll=${longitude}%2C${latitude}&pt=${longitude},${latitude}&z=${zoom}&l=map`;

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-olive/10 bg-cream/70", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-olive">На карте</p>
          <p className="truncate text-xs text-olive/55">{label}</p>
        </div>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-xl border border-primary/24 bg-white px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/8"
        >
          Открыть
        </a>
      </div>
      <iframe
        src={mapUrl}
        title={`Карта: ${label}`}
        className={cn("h-72 w-full border-0", mapClassName)}
        loading="lazy"
      />
    </div>
  );
}
