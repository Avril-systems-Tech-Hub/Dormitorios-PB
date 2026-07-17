/** Stay under next.config serverActions.bodySizeLimit (10 MB) including other fields. */
export const MAX_EXPENSE_RECEIPT_BYTES = 9 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Normalize browser / iOS quirks (`image/jpg`, empty type, octet-stream). */
const MIME_ALIASES: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/heic": "image/heic",
  "image/heif": "image/heif",
};

export const EXPENSE_RECEIPT_MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

export const EXPENSE_RECEIPT_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

function extensionFromName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match?.[1]?.toLowerCase() ?? "";
}

/**
 * Resolve a storage-safe MIME for expense evidence.
 * iOS camera / gallery often returns `""`, `image/jpg`, or `application/octet-stream`.
 */
export function resolveExpenseReceiptMime(
  type: string | null | undefined,
  fileName?: string | null,
): string | null {
  const raw = (type ?? "").trim().toLowerCase();
  if (raw && MIME_ALIASES[raw]) return MIME_ALIASES[raw];

  const fromName = MIME_BY_EXTENSION[extensionFromName(fileName ?? "")];
  if (fromName) return fromName;

  // iOS camera captures without extension/type — treat as JPEG.
  if (!raw || raw === "application/octet-stream") {
    return "image/jpeg";
  }

  return null;
}

export function expenseReceiptExtension(mime: string): string | null {
  return EXPENSE_RECEIPT_MIME_EXTENSIONS[mime] ?? null;
}

export function withResolvedReceiptFile(file: File): File {
  const mime = resolveExpenseReceiptMime(file.type, file.name);
  if (!mime || mime === file.type) return file;
  const name =
    file.name && /\.[a-z0-9]+$/i.test(file.name)
      ? file.name
      : `recibo.${expenseReceiptExtension(mime) ?? "jpg"}`;
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}
