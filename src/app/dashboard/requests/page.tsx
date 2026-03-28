import { redirect } from "next/navigation";

// Requests feature has been disabled in owner dashboard.
export default function DashboardRequestsPage() {
  redirect("/dashboard");
}
