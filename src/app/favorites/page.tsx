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
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <LocalFavoritesPage />
    </div>
  );
}
