// Next.js page for route /favorites.
﻿import { LocalFavoritesPage } from "@/components/favorites/local-favorites-page";

export default function FavoritesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <LocalFavoritesPage />
    </div>
  );
}
