import { Marked } from "marked";

const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export function documentBlocks(sources) {
  if (!Array.isArray(sources) || !sources.length) throw new TypeError("Document sources are required.");
  const markdown = new Marked({ gfm: true, breaks: false, renderer: { html: ({ text }) => escape(text), image: ({ text }) => escape(text || "") } });
  const blocks = [];
  const chapters = [];
  let chapterNumber = 0;
  const render = tokens => markdown.parser(tokens);
  for (const [sourceIndex, source] of sources.entries()) {
    if (typeof source.text !== "string" || !source.text.trim()) throw new TypeError("Empty document source.");
    for (const token of markdown.lexer(source.text)) {
      if (token.type === "space" || token.type === "hr") continue;
      if (token.type === "heading" && token.depth === 1 && sourceIndex === 0) continue;
      if (token.type === "heading" && token.depth <= 2) {
        chapterNumber += 1;
        const title = token.depth === 1 ? source.title || token.text : token.text;
        const id = `chapter-${chapterNumber}`;
        chapters.push({ id, title, number: chapterNumber });
        blocks.push({ kind: "heading", chapter: title, id, html: `<header class="chapter-heading" id="${id}"><span class="chapter-number">${String(chapterNumber).padStart(2, "0")}</span><h2>${escape(title)}</h2></header>` });
      } else if (token.type === "table") {
        const tableGroup = `table-${sourceIndex}-${blocks.length}`;
        for (let offset = 0; offset < token.rows.length; offset += 4) blocks.push({ kind: "table", tableGroup, html: render([{ ...token, rows: token.rows.slice(offset, offset + 4) }]) });
      } else if (token.type === "list") {
        token.items.forEach((item, index) => {
          const ordinal = token.ordered ? `${Number(token.start || 1) + index}.` : "";
          blocks.push({ kind: "list-item", html: `<div class="procedure-row ${token.ordered ? "ordered" : "bullet"}"><span class="step-index">${ordinal}</span><div class="step-copy">${markdown.parse(item.text)}</div></div>` });
        });
      } else if (token.type === "code") {
        blocks.push({ kind: "code", html: `<div class="code-block"><div class="code-language">${escape(token.lang || "reference")}</div><pre><code>${escape(token.text)}</code></pre></div>` });
      } else blocks.push({ kind: token.type === "heading" ? "subheading" : "body", html: render([token]) });
    }
  }
  return { blocks, chapters, sourceCharacters: sources.reduce((sum, source) => sum + source.text.length, 0) };
}