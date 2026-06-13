import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page-bg relative -mt-2 overflow-hidden bg-[#fbf7ef] px-4 py-7 sm:px-5 md:py-9 lg:-mt-4 lg:px-6">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/auth-bekregistor.png')" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-white/8" aria-hidden="true" />

      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/76 bg-white/88 shadow-[0_28px_70px_-44px_rgba(58,43,35,0.55)] ring-1 ring-olive/8 backdrop-blur-xl lg:grid-cols-[minmax(0,1.02fr)_minmax(440px,0.98fr)]">
        <div className="relative hidden min-h-[590px] overflow-hidden lg:block">
          <Image
            src="/auth-frontregistor.png"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="flex min-h-[560px] items-center justify-center px-4 py-7 sm:px-8 md:px-10 lg:px-12">
          <div className="w-full max-w-[500px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
