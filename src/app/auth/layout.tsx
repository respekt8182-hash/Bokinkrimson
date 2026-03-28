// Layout wrapper for route segment /auth.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-6 md:py-10">
      <div className="rounded-2xl bg-white/94 p-5 ring-1 ring-olive/10 md:p-6">{children}</div>
    </div>
  );
}
