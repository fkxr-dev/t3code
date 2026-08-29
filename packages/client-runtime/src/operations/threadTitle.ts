import { truncate } from "@t3tools/shared/String";

export interface ThreadTitleSeedInput {
  readonly text: string;
  readonly attachments: ReadonlyArray<{
    readonly type: "image" | "file";
    readonly name: string;
  }>;
  readonly fallbackLabels?: ReadonlyArray<string | null | undefined>;
}

function normalizeTitleSeed(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function deriveThreadTitleSeed(input: ThreadTitleSeedInput): string {
  const text = normalizeTitleSeed(input.text);
  if (text.length > 0) {
    return truncate(text);
  }

  const firstAttachment = input.attachments[0];
  const attachmentName = normalizeTitleSeed(firstAttachment?.name ?? "");
  if (attachmentName.length > 0) {
    return truncate(`${firstAttachment?.type === "file" ? "File" : "Image"}: ${attachmentName}`);
  }

  for (const label of input.fallbackLabels ?? []) {
    const normalized = normalizeTitleSeed(label ?? "");
    if (normalized.length > 0) {
      return truncate(normalized);
    }
  }

  return "New thread";
}
