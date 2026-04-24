type NormalizePlainTextOptions = {
  preserveNewlines?: boolean;
};

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>\n]*>/g, " ");
}

export function normalizePlainText(
  value: string,
  options: NormalizePlainTextOptions = {},
): string {
  const preserveNewlines = options.preserveNewlines ?? true;
  const normalized = stripHtmlTags(value.normalize("NFKC"))
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n");

  const withoutDangerousControls = normalized.replace(
    preserveNewlines ? /[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g : /[\u0000-\u001f\u007f]/g,
    " ",
  );

  if (!preserveNewlines) {
    return withoutDangerousControls.replace(/\s+/g, " ").trim();
  }

  return withoutDangerousControls
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
