import {
  Note,
  NoteBulletListBlock,
  NoteDocument,
  NoteImageBlock,
  NoteParagraphBlock,
  RichTextSpan,
} from "../types/widget";

export const NOTE_DOCUMENT_VERSION = 1;

const INLINE_TOKEN_PATTERN =
  /(\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\))|(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(https?:\/\/[^\s]+|www\.[^\s]+)/g;

export interface NotePreviewLine {
  prefix?: string;
  text: RichTextSpan[];
}

function getPlainTextFromSpans(spans: RichTextSpan[]): string {
  return spans.map((span) => span.text).join("");
}

function normalizeLinkTarget(text: string): string {
  return text.startsWith("www.") ? `https://${text}` : text;
}

function sanitizeRichTextSpan(raw: unknown): RichTextSpan | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;

  const span = raw as Record<string, unknown>;
  if (typeof span.text !== "string") return null;

  const sanitized: RichTextSpan = { text: span.text };
  if (typeof span.bold === "boolean") sanitized.bold = span.bold;
  if (typeof span.italic === "boolean") sanitized.italic = span.italic;
  if (typeof span.link === "string" && span.link.trim()) {
    sanitized.link = normalizeLinkTarget(span.link.trim());
  }

  return sanitized;
}

function sanitizeRichTextSpans(raw: unknown): RichTextSpan[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => sanitizeRichTextSpan(item))
    .filter((item): item is RichTextSpan => item !== null);
}

function sanitizeParagraphBlock(raw: Record<string, unknown>): NoteParagraphBlock | null {
  const text = sanitizeRichTextSpans(raw.text);
  if (text.length === 0) return null;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : crypto.randomUUID(),
    type: "paragraph",
    text,
  };
}

function sanitizeBulletListBlock(raw: Record<string, unknown>): NoteBulletListBlock | null {
  if (!Array.isArray(raw.items)) return null;

  const items = raw.items
    .map((item) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) return null;

      const record = item as Record<string, unknown>;
      const text = sanitizeRichTextSpans(record.text);
      if (text.length === 0) return null;

      return {
        id: typeof record.id === "string" && record.id.trim() ? record.id : crypto.randomUUID(),
        text,
      };
    })
    .filter((item): item is NoteBulletListBlock["items"][number] => item !== null);

  if (items.length === 0) return null;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : crypto.randomUUID(),
    type: "bullet_list",
    items,
  };
}

function sanitizeImageBlock(raw: Record<string, unknown>): NoteImageBlock | null {
  if (typeof raw.src !== "string" || !raw.src.trim()) return null;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : crypto.randomUUID(),
    type: "image",
    src: raw.src.trim(),
    alt: typeof raw.alt === "string" ? raw.alt : "",
    caption: sanitizeRichTextSpans(raw.caption),
  };
}

export function normalizeNoteDocument(raw: unknown): NoteDocument {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { blocks: [] };
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.blocks)) {
    return { blocks: [] };
  }

  const blocks = record.blocks
    .map((block) => {
      if (block === null || typeof block !== "object" || Array.isArray(block)) return null;

      const item = block as Record<string, unknown>;
      switch (item.type) {
        case "paragraph":
          return sanitizeParagraphBlock(item);
        case "bullet_list":
          return sanitizeBulletListBlock(item);
        case "image":
          return sanitizeImageBlock(item);
        default:
          return null;
      }
    })
    .filter((block): block is NoteDocument["blocks"][number] => block !== null);

  return { blocks };
}

function createTextSpans(text: string): RichTextSpan[] {
  const spans: RichTextSpan[] = [];
  let lastIndex = 0;

  Array.from(text.matchAll(INLINE_TOKEN_PATTERN)).forEach((match) => {
    const matchedText = match[0];
    const startIndex = match.index ?? 0;

    if (startIndex > lastIndex) {
      spans.push({ text: text.slice(lastIndex, startIndex) });
    }

    if (match[2] && match[3]) {
      spans.push({
        text: match[2],
        link: normalizeLinkTarget(match[3]),
      });
    } else if (match[5]) {
      spans.push({
        text: match[5],
        bold: true,
      });
    } else if (match[7]) {
      spans.push({
        text: match[7],
        italic: true,
      });
    } else {
      spans.push({
        text: matchedText,
        link: normalizeLinkTarget(matchedText),
      });
    }

    lastIndex = startIndex + matchedText.length;
  });

  if (lastIndex < text.length) {
    spans.push({ text: text.slice(lastIndex) });
  }

  return spans.length > 0 ? spans : [{ text }];
}

function serializeRichTextSpan(span: RichTextSpan): string {
  if (span.link) {
    return span.text === span.link ? span.link : `[${span.text}](${span.link})`;
  }
  if (span.bold && span.italic) return `***${span.text}***`;
  if (span.bold) return `**${span.text}**`;
  if (span.italic) return `*${span.text}*`;
  return span.text;
}

function serializeRichTextSpans(spans: RichTextSpan[]): string {
  return spans.map((span) => serializeRichTextSpan(span)).join("");
}

function createParagraphBlock(text: string): NoteParagraphBlock {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: createTextSpans(text),
  };
}

function createBulletListBlock(items: string[]): NoteBulletListBlock {
  return {
    id: crypto.randomUUID(),
    type: "bullet_list",
    items: items.map((item) => ({
      id: crypto.randomUUID(),
      text: createTextSpans(item),
    })),
  };
}

export function createPlainTextNoteDocument(content: string): NoteDocument {
  if (!content.trim()) {
    return { blocks: [] };
  }

  const lines = content.split(/\r?\n/);
  const blocks: NoteDocument["blocks"] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);

    if (!bulletMatch) {
      blocks.push(createParagraphBlock(line));
      continue;
    }

    const items = [bulletMatch[1]];

    while (index + 1 < lines.length) {
      const nextMatch = lines[index + 1].match(/^[-*]\s+(.*)$/);
      if (!nextMatch) break;
      items.push(nextMatch[1]);
      index += 1;
    }

    blocks.push(createBulletListBlock(items));
  }

  return normalizeNoteDocument({ blocks });
}

export function getPlainTextFromNoteDocument(document: NoteDocument): string {
  return document.blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return serializeRichTextSpans(block.text);
      }
      if (block.type === "bullet_list") {
        return block.items.map((item) => `- ${serializeRichTextSpans(item.text)}`).join("\n");
      }
      if (block.type === "image") {
        return block.alt || block.src;
      }
      return "";
    })
    .join("\n");
}

export function getNotePreviewLines(document: NoteDocument, maxLines = 3): NotePreviewLine[] {
  const lines = document.blocks.flatMap<NotePreviewLine>((block) => {
    if (block.type === "paragraph") {
      const text = getPlainTextFromSpans(block.text).trim();
      return text ? [{ text: block.text }] : [];
    }

    if (block.type === "bullet_list") {
      return block.items
        .filter((item) => getPlainTextFromSpans(item.text).trim().length > 0)
        .map((item) => ({
          prefix: "\u2022 ",
          text: item.text,
        }));
    }

    if (block.type === "image") {
      const label = block.alt.trim() || "Image";
      return [{ text: [{ text: `[${label}]` }] }];
    }

    return [];
  });

  return lines.slice(0, maxLines);
}

export function getNotePreviewText(document: NoteDocument, maxLength = 120): string {
  const previewText = getNotePreviewLines(document, 6)
    .map((line) => `${line.prefix ?? ""}${getPlainTextFromSpans(line.text)}`)
    .join("\n")
    .trim();

  if (previewText.length <= maxLength) return previewText;
  return `${previewText.slice(0, maxLength).trimEnd()}...`;
}

export function isNoteDocumentEmpty(document: NoteDocument): boolean {
  return getPlainTextFromNoteDocument(document).trim().length === 0;
}

export function createEmptyNote(title = "Untitled"): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    documentVersion: NOTE_DOCUMENT_VERSION,
    document: { blocks: [] },
    createdAt: now,
    updatedAt: now,
  };
}

export function createPlainTextNote(title: string, content: string): Note {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    documentVersion: NOTE_DOCUMENT_VERSION,
    document: createPlainTextNoteDocument(content),
    createdAt: now,
    updatedAt: now,
  };
}
