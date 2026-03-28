// Reusable UI helper/component for property type icon.
import {
  BedDouble,
  Building2,
  HeartPulse,
  House,
  HouseHeart,
  Hotel,
  Mountain,
  TentTree,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";

const propertyTypeIconById: Record<string, LucideIcon> = {
  hotel: Hotel,
  hostel: BedDouble,
  camping: TentTree,
  apartment: Building2,
  house: House,
  private_sector: HouseHeart,
  tour_base: Mountain,
  sanatorium: HeartPulse,
  guest_house: House,
};

type PropertyTypeIconProps = {
  typeId?: string | null;
  className?: string;
};

export function PropertyTypeIcon({ typeId, className }: PropertyTypeIconProps) {
  const Icon = propertyTypeIconById[typeId ?? ""] ?? House;
  return <AppIcon icon={Icon} className={cn("h-5 w-5", className)} />;
}
