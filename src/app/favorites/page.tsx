import type { Metadata } from "next";
import { LocalFavoritesPage } from "@/components/favorites/local-favorites-page";

export const metadata: Metadata = {
  title: "Избранное",
  robots: {
    index: false,
    follow: false,
  },
};

export default function FavoritesPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8 lg:py-10">
      <LocalFavoritesPage />
    </div>
  );
}
