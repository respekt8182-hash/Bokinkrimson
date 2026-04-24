import Link from "next/link";

export type SeoHubLink = {
  href: string;
  label: string;
};

export type SeoHubLinkGroup = {
  title: string;
  links: SeoHubLink[];
};

type SeoHubLinksProps = {
  groups: SeoHubLinkGroup[];
};

export function SeoHubLinks({ groups }: SeoHubLinksProps) {
  const normalizedGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((item) => item.href.trim().length > 0 && item.label.trim().length > 0),
    }))
    .filter((group) => group.links.length > 0);

  if (normalizedGroups.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl bg-white/94 p-4 ring-1 ring-olive/10 md:p-5">
      <h2 className="text-lg font-semibold text-olive">Полезные переходы по разделу</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {normalizedGroups.map((group) => (
          <div key={group.title} className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-olive/42">
              {group.title}
            </h3>
            <div className="flex flex-wrap gap-2">
              {group.links.map((item) => (
                <Link
                  key={`${group.title}-${item.href}-${item.label}`}
                  href={item.href}
                  className="rounded-full border border-olive/14 bg-cream/55 px-3 py-1.5 text-sm text-olive/78 transition hover:border-primary/18 hover:bg-cream hover:text-olive"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
