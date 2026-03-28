// Next.js page for route /dashboard/favorites.
import { redirect } from "next/navigation";

export default async function DashboardFavoritesPage() {
  redirect("/favorites");
}
