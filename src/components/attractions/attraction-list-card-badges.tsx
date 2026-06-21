import { attractionTemplateRegistry, determineAttractionTemplate, type AttractionTemplateInput } from "@/lib/attraction-templates";

export function AttractionListCardBadges({ place, limit = 3 }: { place: AttractionTemplateInput; limit?: number }) {
  const badges = attractionTemplateRegistry[determineAttractionTemplate(place)].catalogBadges.slice(0, limit);
  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span key={badge} className="inline-flex rounded-md bg-sand/50 px-2 py-0.5 text-[11px] font-medium text-olive/65">
          {badge}
        </span>
      ))}
    </div>
  );
}
