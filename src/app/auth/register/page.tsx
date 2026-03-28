// Next.js page for route /auth/register.
import { redirect } from "next/navigation";

export default function RegisterPage() {
  redirect("/auth/login?tab=register");
}
