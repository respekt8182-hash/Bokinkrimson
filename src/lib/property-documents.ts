// Shared property-document contracts: serializer + upload size constraints used by document API routes.
type PropertyDocumentRecord = {
  id: string;
  propertyId: string;
  type: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SerializedPropertyDocument = {
  id: string;
  propertyId: string;
  type: string;
  title: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  url: string;
  createdAt: string;
  updatedAt: string;
};

export const propertyDocumentMaxItems = 10;

export const propertyDocumentSizeLimitBytes = 20 * 1024 * 1024;

export function buildPropertyDocumentDownloadUrl(propertyId: string, documentId: string): string {
  return `/api/properties/${propertyId}/documents/${documentId}`;
}

export function serializePropertyDocument(
  document: PropertyDocumentRecord,
): SerializedPropertyDocument {
  return {
    id: document.id,
    propertyId: document.propertyId,
    type: document.type,
    title: document.title,
    fileName: document.fileName,
    mimeType: document.mimeType,
    fileSize: document.fileSize,
    url: document.url,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
