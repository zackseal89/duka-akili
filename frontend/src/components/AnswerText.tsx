"use client";

import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small markdown renderer for answer text.
 *
 * The agent replies in light markdown: paragraphs, bullet or numbered lists,
 * bold, inline code, and the occasional heading. A full markdown library would
 * be far more than this needs, and rendering raw HTML from the model would be
 * unsafe. So this walks the text, builds React elements, and never sets
 * innerHTML, which keeps model output from injecting markup.
 */

type Inline = string;

function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code first so ** inside code is left alone.
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(__[^_]+__)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyBase}-i${index++}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

interface Block {
  type: "p" | "h" | "ul" | "ol" | "quote";
  lines: Inline[];
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", lines: [paragraph.join(" ")] });
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "h", lines: [heading[2]] });
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ul") last.lines.push(bullet[1]);
      else blocks.push({ type: "ul", lines: [bullet[1]] });
      continue;
    }

    const numbered = /^\d+[.)]\s+(.*)$/.exec(trimmed);
    if (numbered) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "ol") last.lines.push(numbered[1]);
      else blocks.push({ type: "ol", lines: [numbered[1]] });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(trimmed);
    if (quote) {
      flushParagraph();
      const last = blocks[blocks.length - 1];
      if (last && last.type === "quote") last.lines.push(quote[1]);
      else blocks.push({ type: "quote", lines: [quote[1]] });
      continue;
    }

    paragraph.push(trimmed);
  }
  flushParagraph();
  return blocks;
}

export function AnswerText({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const blocks = parseBlocks(text);
  const caret = streaming ? (
    <span
      className="caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-full bg-brand align-baseline"
      aria-hidden="true"
    />
  ) : null;

  return (
    <div className="answer">
      {blocks.map((block, blockIndex) => {
        const isLast = blockIndex === blocks.length - 1;
        const key = `b-${blockIndex}`;

        if (block.type === "h") {
          return (
            <h3 key={key}>
              {renderInline(block.lines[0], key)}
              {isLast ? caret : null}
            </h3>
          );
        }
        if (block.type === "quote") {
          return (
            <blockquote key={key}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={`${key}-${lineIndex}`}>
                  {renderInline(line, `${key}-${lineIndex}`)}
                  {lineIndex < block.lines.length - 1 ? <br /> : null}
                </Fragment>
              ))}
              {isLast ? caret : null}
            </blockquote>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          const ListTag = block.type === "ul" ? "ul" : "ol";
          return (
            <ListTag
              key={key}
              className={
                block.type === "ul"
                  ? "list-disc space-y-1.5 pl-5 marker:text-brand"
                  : "list-decimal space-y-1.5 pl-5 marker:text-brand marker:font-medium"
              }
            >
              {block.lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>
                  {renderInline(line, `${key}-${lineIndex}`)}
                  {isLast && lineIndex === block.lines.length - 1 ? caret : null}
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={key}>
            {renderInline(block.lines[0], key)}
            {isLast ? caret : null}
          </p>
        );
      })}
      {blocks.length === 0 ? <p>{caret}</p> : null}
    </div>
  );
}
