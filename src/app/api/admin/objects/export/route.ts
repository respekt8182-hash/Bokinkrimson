import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { db } from "@/lib/db";
import { buildPublicCatalogPropertyVisibilityWhere } from "@/lib/public-visibility";

type PublishedPropertyExportRow = {
  ownerId: string;
  ownerName: string;
  ownerPhone: string;
  properties: Array<{
    publicId: number | null;
    name: string | null;
    locationName: string | null;
    address: string | null;
    phone: string | null;
    phone2: string | null;
    phone3: string | null;
  }>;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function makeCell(value: string | number): string {
  return `<Cell ss:StyleID="wrap"><Data ss:Type="String">${escapeXml(String(value))}</Data></Cell>`;
}

function makeRow(values: Array<string | number>): string {
  return `<Row>${values.map(makeCell).join("")}</Row>`;
}

function normalizeList(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)),
    ),
  );
}

function formatOwnerName(owner: { firstName: string; lastName: string }): string {
  return [owner.firstName, owner.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

function formatPropertyTitle(property: PublishedPropertyExportRow["properties"][number]): string {
  const title = property.name?.trim() || "Объект без названия";
  return property.publicId ? `ID ${property.publicId}: ${title}` : title;
}

function formatPropertyAddress(property: PublishedPropertyExportRow["properties"][number]): string {
  const parts = [property.locationName, property.address]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "Адрес не указан";
}

function buildWorkbook(rows: PublishedPropertyExportRow[]): string {
  const tableRows = [
    makeRow([
      "Имя",
      "Номер телефона",
      "Опубликованных объектов",
      "Объект(ы)",
      "Адрес(а) объектов",
      "Телефоны объектов",
    ]),
    ...rows.map((row) =>
      makeRow([
        row.ownerName || "Имя не указано",
        row.ownerPhone || "Телефон не указан",
        row.properties.length,
        row.properties.map(formatPropertyTitle).join("\n"),
        row.properties.map(formatPropertyAddress).join("\n"),
        normalizeList(
          row.properties.flatMap((property) => [property.phone, property.phone2, property.phone3]),
        ).join("\n") || "Не указаны",
      ]),
    ),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="wrap">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Опубликованные объекты">
    <Table>
      <Column ss:Width="180"/>
      <Column ss:Width="130"/>
      <Column ss:Width="105"/>
      <Column ss:Width="260"/>
      <Column ss:Width="320"/>
      <Column ss:Width="180"/>
      ${tableRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

export async function GET() {
  const admin = await getAdminSession();

  if (!admin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 });
  }

  const properties = await db.property.findMany({
    where: buildPublicCatalogPropertyVisibilityWhere(),
    orderBy: [{ ownerId: "asc" }, { updatedAt: "desc" }],
    select: {
      publicId: true,
      ownerId: true,
      name: true,
      locationName: true,
      address: true,
      phone: true,
      phone2: true,
      phone3: true,
      owner: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
    },
  });

  const rowsByOwner = new Map<string, PublishedPropertyExportRow>();

  for (const property of properties) {
    const existing = rowsByOwner.get(property.ownerId);

    if (existing) {
      existing.properties.push(property);
      continue;
    }

    rowsByOwner.set(property.ownerId, {
      ownerId: property.ownerId,
      ownerName: formatOwnerName(property.owner),
      ownerPhone: property.owner.phone,
      properties: [property],
    });
  }

  const workbook = buildWorkbook(Array.from(rowsByOwner.values()));
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(workbook, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="published-properties-${stamp}.xls"`,
      "Cache-Control": "no-store",
    },
  });
}
