import { describe, expect, it } from "@effect/vitest";
import { ChatAttachmentId, type ChatAttachment } from "@t3tools/contracts";

import { appendAttachmentPathReferences, imageAttachments } from "./AttachmentPrompt.ts";

const attachments: ReadonlyArray<ChatAttachment> = [
  {
    type: "image",
    id: ChatAttachmentId.make("thread-1-00000000-0000-4000-8000-000000000001"),
    name: "diagram.png",
    mimeType: "image/png",
    sizeBytes: 4,
  },
  {
    type: "file",
    id: ChatAttachmentId.make("thread-1-00000000-0000-4000-8000-000000000002-pdf"),
    name: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: 8,
  },
];

describe("AttachmentPrompt", () => {
  it("adds readable paths for images and generic files", () => {
    expect(
      appendAttachmentPathReferences({
        text: "Review these files.",
        attachments,
        resolvePath: (attachment) => `/attachments/${attachment.id}`,
      }),
    ).toBe(
      `Review these files.\n\n[Attached image "diagram.png" is saved at: /attachments/${attachments[0]!.id}]\n[Attached file "report.pdf" is saved at: /attachments/${attachments[1]!.id}]`,
    );
  });

  it("passes only image attachments to image-native provider inputs", () => {
    expect(imageAttachments(attachments)).toEqual([attachments[0]]);
  });
});
