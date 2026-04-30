import { ArrowUpRight, Camera, MapPin, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AdminPageHeader,
  AdminPanel,
  adminInputClass,
  adminTextareaClass,
} from "@/components/admin/admin-ui";
import { AdminAttractionGalleryManager } from "@/components/admin/admin-attraction-gallery-manager";
import { AdminAttractionLocationEditor } from "@/components/admin/admin-attraction-location-editor";
import { verifyAdminSession } from "@/lib/admin-standalone-auth";
import { buildPublicAttractionPath } from "@/lib/public-marketplace";
import {
  getStaticAttractionById,
  saveStaticAttraction,
  type StaticAttraction,
  type StaticAttractionEditablePatch,
  type StaticAttractionFaqItem,
  type StaticAttractionFact,
  type StaticAttractionGalleryImage,
  type StaticAttractionSection,
  type StaticAttractionStatus,
} from "@/lib/static-attractions";

type AdminAttractionEditPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABELS: Record<StaticAttractionStatus, string> = {
  DRAFT: "Черновик",
  PUBLISHED: "Опубликовано",
  HIDDEN: "Скрыто",
};

function formString(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function formNumber(formData: FormData, key: string): number | null {
  const value = formString(formData, key)?.replace(",", ".");
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseStatus(value: string | null): StaticAttractionStatus {
  return value === "PUBLISHED" || value === "HIDDEN" ? value : "DRAFT";
}

function splitList(value: string | null): string[] {
  return (value ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitParagraphs(value: string | null): string[] {
  return (value ?? "")
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseGallery(formData: FormData, fallbackAlt: string): StaticAttractionGalleryImage[] {
  const urls = formData.getAll("galleryUrl");
  const alts = formData.getAll("galleryAlt");
  const orders = formData.getAll("galleryOrder");
  const items = urls
    .map((urlValue, index) => {
      const url = typeof urlValue === "string" ? urlValue.trim() : "";
      if (!url) {
        return null;
      }

      const orderValue = orders[index];
      const order =
        typeof orderValue === "string" && Number.isFinite(Number(orderValue))
          ? Number(orderValue)
          : index + 1;
      const altValue = alts[index];
      const alt = typeof altValue === "string" && altValue.trim() ? altValue.trim() : fallbackAlt;

      return { order, url, alt };
    })
    .filter((item): item is { order: number; url: string; alt: string } => Boolean(item));

  for (const url of splitList(formString(formData, "extraGalleryUrls"))) {
    items.push({
      order: items.length + 1,
      url,
      alt: fallbackAlt,
    });
  }

  const seen = new Set<string>();
  return items
    .sort((left, right) => left.order - right.order)
    .filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    })
    .map(({ url, alt }) => ({ url, alt }));
}

function parseFacts(formData: FormData): StaticAttractionFact[] {
  const labels = formData.getAll("factLabel");
  const values = formData.getAll("factValue");

  return labels
    .map((labelValue, index) => {
      const label = typeof labelValue === "string" ? labelValue.trim() : "";
      const valueRaw = values[index];
      const value = typeof valueRaw === "string" ? valueRaw.trim() : "";
      return label && value ? { label, value } : null;
    })
    .filter((item): item is StaticAttractionFact => Boolean(item));
}

function parseSections(formData: FormData): StaticAttractionSection[] {
  const titles = formData.getAll("sectionTitle");
  const bodies = formData.getAll("sectionBody");
  const lists = formData.getAll("sectionList");

  return titles
    .map((titleValue, index) => {
      const title = typeof titleValue === "string" ? titleValue.trim() : "";
      const bodyValue = bodies[index];
      const listValue = lists[index];
      const body = splitParagraphs(typeof bodyValue === "string" ? bodyValue : null);
      const list = splitList(typeof listValue === "string" ? listValue : null);

      if (!title || (body.length === 0 && list.length === 0)) {
        return null;
      }

      return {
        title,
        body,
        ...(list.length > 0 ? { list } : {}),
      };
    })
    .filter((item): item is StaticAttractionSection => Boolean(item));
}

function parseFaq(formData: FormData): StaticAttractionFaqItem[] {
  const questions = formData.getAll("faqQuestion");
  const answers = formData.getAll("faqAnswer");

  return questions
    .map((questionValue, index) => {
      const question = typeof questionValue === "string" ? questionValue.trim() : "";
      const answerRaw = answers[index];
      const answer = typeof answerRaw === "string" ? answerRaw.trim() : "";
      return question && answer ? { question, answer } : null;
    })
    .filter((item): item is StaticAttractionFaqItem => Boolean(item));
}

function buildEditablePatch(
  attraction: StaticAttraction,
  formData: FormData,
  adminLogin: string,
): StaticAttractionEditablePatch {
  const title = formString(formData, "title") ?? "Достопримечательность";

  return {
    title,
    slug: formString(formData, "slug") ?? attraction.slug,
    h1: formString(formData, "h1") ?? title,
    seoTitle: formString(formData, "seoTitle") ?? `${title} - досуг в Крыму`,
    metaDescription: formString(formData, "metaDescription") ?? "",
    category: formString(formData, "category"),
    tags: splitList(formString(formData, "tags")),
    locationName: formString(formData, "locationName"),
    locationAliases: splitList(formString(formData, "locationAliases")),
    districtName: formString(formData, "districtName"),
    address: formString(formData, "address"),
    latitude: formNumber(formData, "latitude"),
    longitude: formNumber(formData, "longitude"),
    shortDescription: formString(formData, "shortDescription"),
    description: formString(formData, "description"),
    gallery: parseGallery(formData, title),
    websiteUrl: formString(formData, "websiteUrl"),
    mapUrl: formString(formData, "mapUrl"),
    facts: parseFacts(formData),
    sections: parseSections(formData),
    nearby: splitList(formString(formData, "nearby")),
    faq: parseFaq(formData),
    searchKeywords: splitList(formString(formData, "searchKeywords")),
    status: parseStatus(formString(formData, "status")),
    isPublishedVisible: formData.get("isPublishedVisible") === "on",
    createdByLogin: attraction.createdByLogin ?? adminLogin,
    createdAt: attraction.createdAt,
  };
}

function textareaValue(values: string[]): string {
  return values.join("\n");
}

function paragraphTextareaValue(values: string[]): string {
  return values.join("\n\n");
}

export default async function AdminAttractionEditPage({ params }: AdminAttractionEditPageProps) {
  const { id } = await params;
  const attraction = await getStaticAttractionById(id);

  if (!attraction) {
    notFound();
  }

  async function saveAttraction(formData: FormData) {
    "use server";

    const admin = await verifyAdminSession();
    if (!admin) {
      redirect("/admin/login");
    }

    const current = await getStaticAttractionById(id);
    if (!current) {
      notFound();
    }

    await saveStaticAttraction(id, buildEditablePatch(current, formData, admin.login));
    redirect(`/admin/attractions/${id}?saved=1`);
  }

  const publicPath =
    attraction.status === "PUBLISHED" && attraction.isPublishedVisible
      ? buildPublicAttractionPath({
          id: attraction.id,
          title: attraction.title,
          slug: attraction.slug,
        })
      : null;
  const sectionRows: StaticAttractionSection[] = [
    ...attraction.sections,
    { title: "", body: [], list: [] },
  ];
  const factRows: StaticAttractionFact[] = [
    ...attraction.facts,
    { label: "", value: "" },
    { label: "", value: "" },
  ];
  const faqRows: StaticAttractionFaqItem[] = [
    ...attraction.faq,
    { question: "", answer: "" },
    { question: "", answer: "" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Достопримечательности"
        title={attraction.title || "Достопримечательность без названия"}
        description={`Статус: ${STATUS_LABELS[attraction.status]}. Данные берутся из кода, а эта форма сохраняет правки в файловый override.`}
        actions={
          <>
            <Link
              href="/admin/attractions"
              className="inline-flex items-center rounded-2xl border border-olive/12 bg-white px-4 py-3 text-sm font-semibold text-olive transition hover:border-primary/18 hover:text-primary"
            >
              К каталогу
            </Link>
            {publicPath ? (
              <Link
                href={publicPath}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary/8 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/12"
              >
                <ArrowUpRight className="h-4 w-4" />
                Открыть на сайте
              </Link>
            ) : null}
          </>
        }
      />

      <form action={saveAttraction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <AdminPanel title="SEO и карточка">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Название</span>
                <input name="title" defaultValue={attraction.title} className={adminInputClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">URL slug</span>
                <input name="slug" defaultValue={attraction.slug} className={adminInputClass} />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">H1</span>
                <input name="h1" defaultValue={attraction.h1} className={adminInputClass} />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">SEO Title</span>
                <input
                  name="seoTitle"
                  defaultValue={attraction.seoTitle}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Meta Description</span>
                <textarea
                  name="metaDescription"
                  defaultValue={attraction.metaDescription}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Категория</span>
                <input
                  name="category"
                  defaultValue={attraction.category ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Статус</span>
                <select name="status" defaultValue={attraction.status} className={adminInputClass}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Короткое описание</span>
                <textarea
                  name="shortDescription"
                  defaultValue={attraction.shortDescription ?? ""}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-olive">Описание под заголовком</span>
                <textarea
                  name="description"
                  defaultValue={attraction.description ?? ""}
                  className={adminTextareaClass}
                />
              </label>
            </div>
          </AdminPanel>

          <AdminPanel title="Локация">
            <AdminAttractionLocationEditor
              title={attraction.title}
              locationName={attraction.locationName ?? ""}
              districtName={attraction.districtName ?? ""}
              address={attraction.address ?? ""}
              latitude={attraction.latitude}
              longitude={attraction.longitude}
              locationAliases={attraction.locationAliases}
              mapUrl={attraction.mapUrl ?? ""}
            />
          </AdminPanel>

          <AdminPanel title="Фотографии">
            <AdminAttractionGalleryManager
              images={attraction.gallery}
              fallbackAlt={attraction.title}
            />
          </AdminPanel>

          <AdminPanel title="Факты">
            <div className="grid gap-3 md:grid-cols-2">
              {factRows.map((fact, index) => (
                <div key={`fact-${index}`} className="grid gap-2 rounded-2xl bg-cream/62 p-3">
                  <input
                    name="factLabel"
                    defaultValue={fact.label}
                    placeholder="Подпись"
                    className={adminInputClass}
                  />
                  <input
                    name="factValue"
                    defaultValue={fact.value}
                    placeholder="Значение"
                    className={adminInputClass}
                  />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="Секции страницы">
            <div className="space-y-4">
              {sectionRows.map((section, index) => (
                <div key={`section-${index}`} className="grid gap-3 rounded-2xl bg-cream/62 p-3">
                  <input
                    name="sectionTitle"
                    defaultValue={section.title}
                    placeholder="Заголовок секции"
                    className={adminInputClass}
                  />
                  <textarea
                    name="sectionBody"
                    defaultValue={paragraphTextareaValue(section.body)}
                    placeholder="Абзацы через пустую строку"
                    className={adminTextareaClass}
                  />
                  <textarea
                    name="sectionList"
                    defaultValue={textareaValue(section.list ?? [])}
                    placeholder="Список, каждый пункт с новой строки"
                    className={adminTextareaClass}
                  />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel title="FAQ и места рядом">
            <div className="grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Что рядом</span>
                <textarea
                  name="nearby"
                  defaultValue={textareaValue(attraction.nearby)}
                  className={adminTextareaClass}
                />
              </label>
              <div className="space-y-3">
                {faqRows.map((faqItem, index) => (
                  <div key={`faq-${index}`} className="grid gap-2 rounded-2xl bg-cream/62 p-3">
                    <input
                      name="faqQuestion"
                      defaultValue={faqItem.question}
                      placeholder="Вопрос"
                      className={adminInputClass}
                    />
                    <textarea
                      name="faqAnswer"
                      defaultValue={faqItem.answer}
                      placeholder="Ответ"
                      className={adminTextareaClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          </AdminPanel>
        </div>

        <aside className="space-y-4">
          <AdminPanel>
            <div className="overflow-hidden rounded-2xl bg-cream">
              {attraction.gallery[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={attraction.gallery[0].url}
                  alt={attraction.gallery[0].alt || attraction.title}
                  className="aspect-[16/10] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[16/10] items-center justify-center">
                  <Camera className="h-8 w-8 text-olive/35" />
                </div>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm text-olive/62">
              <p>Базовая запись остаётся в коде. Эта форма сохраняет только переопределения.</p>
              <p className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-xs font-semibold text-olive/65">
                <MapPin className="h-4 w-4" />
                {attraction.locationName ?? "Локация не указана"}
              </p>
            </div>
          </AdminPanel>

          <AdminPanel title="Публикация">
            <label className="flex items-start gap-3 rounded-2xl bg-cream/70 p-3 text-sm text-olive/70">
              <input
                type="checkbox"
                name="isPublishedVisible"
                defaultChecked={attraction.isPublishedVisible}
                className="mt-1 h-4 w-4 rounded border-olive/25 text-primary focus:ring-primary/20"
              />
              Показывать на сайте, если статус опубликован
            </label>
            <button
              type="submit"
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              <Save className="h-4 w-4" />
              Сохранить
            </button>
          </AdminPanel>

          <AdminPanel title="Ссылки и поиск">
            <div className="grid gap-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Официальный сайт</span>
                <input
                  name="websiteUrl"
                  defaultValue={attraction.websiteUrl ?? ""}
                  className={adminInputClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">Теги</span>
                <textarea
                  name="tags"
                  defaultValue={textareaValue(attraction.tags)}
                  className={adminTextareaClass}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-olive">SEO-запросы</span>
                <textarea
                  name="searchKeywords"
                  defaultValue={textareaValue(attraction.searchKeywords)}
                  className={adminTextareaClass}
                />
              </label>
            </div>
          </AdminPanel>
        </aside>
      </form>
    </div>
  );
}
