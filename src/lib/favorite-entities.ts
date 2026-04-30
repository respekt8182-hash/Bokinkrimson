export type FavoriteEntityType = "property" | "excursion" | "tour" | "attraction" | "transfer";

export function isFavoriteEntityType(value: unknown): value is FavoriteEntityType {
  return (
    value === "property" ||
    value === "excursion" ||
    value === "tour" ||
    value === "attraction" ||
    value === "transfer"
  );
}

export function getFavoriteEntityTypeFromOfferType(
  offerType: string | null | undefined,
): FavoriteEntityType {
  return offerType === "TOUR" ? "tour" : "excursion";
}

export function getFavoriteEntityFilterLabel(entityType: FavoriteEntityType): string {
  switch (entityType) {
    case "property":
      return "Жилье";
    case "tour":
      return "Туры";
    case "attraction":
      return "Досуг";
    case "transfer":
      return "Трансферы";
    case "excursion":
    default:
      return "Экскурсии";
  }
}

export function getFavoriteEntityCardLabel(entityType: FavoriteEntityType): string {
  switch (entityType) {
    case "property":
      return "Объект размещения";
    case "tour":
      return "Тур";
    case "attraction":
      return "Досуг";
    case "transfer":
      return "Трансфер";
    case "excursion":
    default:
      return "Экскурсия";
  }
}

export function getFavoriteEntityActionLabel(
  entityType: FavoriteEntityType,
  isFavorite: boolean,
): string {
  switch (entityType) {
    case "property":
      return isFavorite ? "Убрать объект из избранного" : "Добавить объект в избранное";
    case "tour":
      return isFavorite ? "Убрать тур из избранного" : "Добавить тур в избранное";
    case "attraction":
      return isFavorite ? "Убрать досуг из избранного" : "Добавить досуг в избранное";
    case "transfer":
      return isFavorite ? "Убрать трансфер из избранного" : "Добавить трансфер в избранное";
    case "excursion":
    default:
      return isFavorite ? "Убрать экскурсию из избранного" : "Добавить экскурсию в избранное";
  }
}
