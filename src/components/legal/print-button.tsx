"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl border border-olive/15 bg-white px-3 py-2 text-sm font-semibold text-olive/70 transition hover:bg-cream hover:text-olive print:hidden"
    >
      Печать
    </button>
  );
}
