import { NextResponse } from "next/server";
import { readPublicUploadFromStorage } from "@/lib/storage";

type RouteContext = {
  params: Promise<{
    key: string[];
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;

  if (!Array.isArray(key) || key.length === 0) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  let stored: Awaited<ReturnType<typeof readPublicUploadFromStorage>>;

  try {
    stored = await readPublicUploadFromStorage(key.join("/"));
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(stored.body), {
    status: 200,
    headers: {
      "Content-Type": stored.contentType,
      "Content-Length": String(stored.contentLength),
      "Content-Disposition": stored.contentDisposition,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
