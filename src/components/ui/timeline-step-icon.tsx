"use client";

// Reusable UI helper/component for timeline step icon.
import {
  Bus,
  CableCar,
  Camera,
  Castle,
  Clock3,
  Flag,
  Footprints,
  Landmark,
  MapPin,
  Mountain,
  Ship,
  ShoppingBag,
  Sunset,
  UtensilsCrossed,
  Waves,
  Wine,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AppIcon, type LucideIcon } from "@/components/ui/app-icon";
import type { TimelineStepIcon as TimelineStepIconName } from "@/types/excursions";

const timelineIconById: Record<TimelineStepIconName, LucideIcon> = {
  meeting_point: MapPin,
  bus: Bus,
  walking: Footprints,
  sightseeing: Castle,
  viewpoint: Mountain,
  cable_car: CableCar,
  wine_tasting: Wine,
  food: UtensilsCrossed,
  photo_stop: Camera,
  free_time: Clock3,
  museum: Landmark,
  beach: Waves,
  swimming: Waves,
  hiking: Mountain,
  boat: Ship,
  shopping: ShoppingBag,
  sunset: Sunset,
  finish: Flag,
};

type TimelineStepIconProps = {
  icon: TimelineStepIconName;
  className?: string;
};

export function TimelineStepIcon({ icon, className }: TimelineStepIconProps) {
  return <AppIcon icon={timelineIconById[icon]} className={cn("h-4 w-4", className)} />;
}
