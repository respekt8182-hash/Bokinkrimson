// Property documents endpoint: list and upload owner documents linked to an object card.
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  propertyDocumentSizeLimitBytes,
  serializePropertyDocument,
} from "@/lib/property-documents";
import { uploadToStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function ensureOwner(propertyId: string, userId: string) {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      ownerId: true,
      ownerDeletedAt: true,
    },
  });

  if (!property || property.ownerId !== userId || property.ownerDeletedAt) {
    return null;
  }

  return property;
}

async function listPropertyDocuments(propertyId: string) {
  const items = await db.propertyDocument.findMany({
    where: { propertyId },
    orderBy: [{ createdAt: "desc" }],
  });

  return items.map(serializePropertyDocument);
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensureOwner(id, session.id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  return NextResponse.json({ items: await listPropertyDocuments(property.id) });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await ensureOwner(id, session.id);

  if (!property) {
    return NextResponse.json({ error: "Объект не найден" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const type = (formData.get("type")?.toString().trim() || "DOCUMENT").slice(0, 40);
  const titleValue = formData.get("title")?.toString().trim() || "";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Файл документа не передан" }, { status: 400 });
  }

  if (file.size <= 0) {
    return NextResponse.json({ error: "Файл документа пустой" }, { status: 400 });
  }

  if (file.size > propertyDocumentSizeLimitBytes) {
    return NextResponse.json(
      { error: "Размер документа не должен превышать 20 МБ" },
      { status: 400 },
    );
  }

  const fileName = file.name.trim() || "document";
  const normalizedTitle = titleValue.length > 0 ? titleValue : fileName;
  const storageKey = `properties/${property.id}/documents/${Date.now()}-${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
  const uploaded = await uploadToStorage({
    key: storageKey,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || "application/octet-stream",
  });

  await db.propertyDocument.create({
    data: {
      propertyId: property.id,
      type,
      title: normalizedTitle.slice(0, 160),
      fileName: fileName.slice(0, 255),
      mimeType: (file.type || "application/octet-stream").slice(0, 120),
      fileSize: file.size,
      url: uploaded.url,
      storageKey,
    },
  });

  return NextResponse.json({ items: await listPropertyDocuments(property.id) }, { status: 201 });
}
