// Next.js page for route /auth/login.
import { AuthEntryPanel } from "@/components/forms/auth-entry-panel";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function pick(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = pick(params.next);
  const tabParam = pick(params.tab);
  const defaultTab = tabParam === "register" ? "register" : "login";

  return (
    <div>
      <AuthEntryPanel nextPath={nextPath} defaultTab={defaultTab} />
    </div>
  );
}
