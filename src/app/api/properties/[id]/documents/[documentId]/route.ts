// Property document endpoint: controlled download and delete for owner/admin document access.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEditorSession } from "@/lib/editor-access";
import { deleteFromStorage, readFromStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    id: string;
    documentId: string;
  }>;
};

async function getAccessibleDocument(
  propertyId: string,
  documentId: string,
  editor: Awaited<ReturnType<typeof getEditorSession>>,
) {
  const document = await db.propertyDocument.findUnique({
    where: { id: documentId },
    include: {
      property: {
        select: {
          id: true,
          ownerId: true,
          ownerDeletedAt: true,
        },
      },
    },
  });

  if (
    !document ||
    document.propertyId !== propertyId ||
    document.property.ownerDeletedAt ||
    (!editor?.isAdmin && document.property.ownerId !== editor?.id)
  ) {
    return null;
  }

  return document;
}

export async function GET(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id, documentId } = await context.params;
  const document = await getAccessibleDocument(id, documentId, editor);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const stored = await readFromStorage(document.storageKey);

  return new NextResponse(new Uint8Array(stored.body), {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": String(stored.contentLength),
      "Content-Disposition": `attachment; filename="${document.fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const editor = await getEditorSession();

  if (!editor) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { id, documentId } = await context.params;
  const document = await getAccessibleDocument(id, documentId, editor);

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await db.propertyDocument.delete({
    where: {
      id: document.id,
    },
  });

  await deleteFromStorage(document.storageKey).catch(() => null);

  return NextResponse.json({ ok: true });
}
