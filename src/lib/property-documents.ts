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
  storageKey: string;
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
  storageKey: string;
  createdAt: string;
  updatedAt: string;
};

export const propertyDocumentSizeLimitBytes = 20 * 1024 * 1024;

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
    storageKey: document.storageKey,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}
