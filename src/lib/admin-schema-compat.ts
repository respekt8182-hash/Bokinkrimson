import { areDatabaseColumnsAvailable } from "@/lib/db";

export const PROPERTY_PUBLICATION_CONTROL_COLUMNS = ["isPublishedVisible"] as const;
export const EXCURSION_VISIBILITY_CONTROL_COLUMNS = ["isPublishedVisible"] as const;
export const EXCURSION_SOFT_DELETE_COLUMNS = [
  "deletedAt",
  "deletionExpiresAt",
  "isPublishedVisible",
] as const;

export async function isPropertyPublicationControlAvailable(): Promise<boolean> {
  return areDatabaseColumnsAvailable("Property", PROPERTY_PUBLICATION_CONTROL_COLUMNS);
}

export async function isExcursionVisibilityControlAvailable(): Promise<boolean> {
  return areDatabaseColumnsAvailable("Excursion", EXCURSION_VISIBILITY_CONTROL_COLUMNS);
}

export async function isExcursionSoftDeleteAvailable(): Promise<boolean> {
  return areDatabaseColumnsAvailable("Excursion", EXCURSION_SOFT_DELETE_COLUMNS);
}
