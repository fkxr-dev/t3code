import type { ChatAttachment, ChatImageAttachment } from "@t3tools/contracts";

export function appendAttachmentPathReferences(input: {
  readonly text: string;
  readonly attachments: ReadonlyArray<ChatAttachment>;
  readonly resolvePath: (attachment: ChatAttachment) => string | null;
}): string {
  const pathLines = input.attachments.flatMap((attachment) => {
    const path = input.resolvePath(attachment);
    return path === null
      ? []
      : [`[Attached ${attachment.type} "${attachment.name}" is saved at: ${path}]`];
  });
  return [input.text, pathLines.join("\n")].filter((part) => part.length > 0).join("\n\n");
}

export function imageAttachments(
  attachments: ReadonlyArray<ChatAttachment>,
): ReadonlyArray<ChatImageAttachment> {
  return attachments.filter(
    (attachment): attachment is ChatImageAttachment => attachment.type === "image",
  );
}
