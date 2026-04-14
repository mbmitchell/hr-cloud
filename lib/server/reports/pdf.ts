import type { ReportNotesConfig } from "./report-notes";

type PdfColumn = {
  label: string;
  width: number;
};

type PdfFilter = {
  label: string;
  value: string;
};

type PdfReportInput = {
  title: string;
  subtitle: string;
  generatedAt: string;
  appliedFilters: PdfFilter[];
  notes: ReportNotesConfig;
  columns: PdfColumn[];
  rows: string[][];
};

type PdfTextLine = {
  text: string;
  x: number;
  y: number;
  font: "F1" | "F2" | "F3" | "F4";
  size: number;
};

const PAGE_WIDTH = 792;
const PAGE_HEIGHT = 612;
const MARGIN_X = 36;
const TOP_Y = 570;
const BOTTOM_Y = 36;
const NORMAL_LINE_HEIGHT = 12;
const TABLE_LINE_HEIGHT = 10;
const NOTES_WRAP = 108;
const TABLE_WRAP = 125;

function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function truncateText(value: string, width: number) {
  if (value.length <= width) {
    return value.padEnd(width, " ");
  }

  if (width <= 3) {
    return value.slice(0, width);
  }

  return `${value.slice(0, width - 3)}...`;
}

function buildTableLine(columns: PdfColumn[], cells: string[]) {
  return columns
    .map((column, index) => truncateText(cells[index] ?? "", column.width))
    .join("  ");
}

function splitTableLine(line: string) {
  if (line.length <= TABLE_WRAP) {
    return [line];
  }

  const segments: string[] = [];
  for (let start = 0; start < line.length; start += TABLE_WRAP) {
    segments.push(line.slice(start, start + TABLE_WRAP));
  }
  return segments;
}

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function buildPageTextLines(input: PdfReportInput) {
  const pages: PdfTextLine[][] = [];
  let pageNumber = 0;
  let currentPage: PdfTextLine[] = [];
  let cursorY = TOP_Y;

  function startPage() {
    pageNumber += 1;
    currentPage = [];
    cursorY = TOP_Y;

    currentPage.push(
      { text: input.title, x: MARGIN_X, y: cursorY, font: "F2", size: 16 },
      {
        text: input.subtitle,
        x: MARGIN_X,
        y: cursorY - 18,
        font: "F1",
        size: 10,
      },
      {
        text: `Generated: ${input.generatedAt}`,
        x: PAGE_WIDTH - 230,
        y: cursorY,
        font: "F1",
        size: 9,
      }
    );

    cursorY -= 34;
  }

  function flushPage() {
    currentPage.push({
      text: `Page ${pageNumber}`,
      x: PAGE_WIDTH - 72,
      y: 20,
      font: "F1",
      size: 9,
    });
    pages.push(currentPage);
  }

  function ensureSpace(lineHeight: number) {
    if (cursorY - lineHeight < BOTTOM_Y) {
      flushPage();
      startPage();
    }
  }

  function addLine(
    text: string,
    options?: { font?: PdfTextLine["font"]; size?: number; lineHeight?: number; x?: number }
  ) {
    const font = options?.font ?? "F1";
    const size = options?.size ?? 9;
    const lineHeight = options?.lineHeight ?? NORMAL_LINE_HEIGHT;
    const x = options?.x ?? MARGIN_X;
    ensureSpace(lineHeight);
    currentPage.push({ text, x, y: cursorY, font, size });
    cursorY -= lineHeight;
  }

  startPage();

  addLine("Applied Filters", { font: "F2", size: 11, lineHeight: 14 });
  if (input.appliedFilters.length === 0) {
    addLine("All current records in report scope", { font: "F1" });
  } else {
    for (const filter of input.appliedFilters) {
      for (const line of wrapText(`${filter.label}: ${filter.value}`, NOTES_WRAP)) {
        addLine(line);
      }
    }
  }

  addLine("");
  addLine("Report Notes", { font: "F2", size: 11, lineHeight: 14 });
  for (const line of wrapText(`Purpose: ${input.notes.purpose}`, NOTES_WRAP)) {
    addLine(line);
  }
  for (const line of wrapText(`Source of Truth: ${input.notes.sourceOfTruth}`, NOTES_WRAP)) {
    addLine(line);
  }
  for (const definition of input.notes.definitions) {
    for (const line of wrapText(`${definition.label}: ${definition.text}`, NOTES_WRAP)) {
      addLine(line);
    }
  }
  for (const line of wrapText(`Filter / Export Note: ${input.notes.filterExportNote}`, NOTES_WRAP)) {
    addLine(line);
  }

  addLine("");
  addLine("Table Output", { font: "F2", size: 11, lineHeight: 14 });

  const headerLine = buildTableLine(
    input.columns,
    input.columns.map((column) => column.label)
  );
  const separatorLine = "-".repeat(Math.min(headerLine.length, TABLE_WRAP));
  for (const line of splitTableLine(headerLine)) {
    addLine(line, { font: "F4", size: 8.5, lineHeight: TABLE_LINE_HEIGHT });
  }
  addLine(separatorLine, { font: "F3", size: 8.5, lineHeight: TABLE_LINE_HEIGHT });

  if (input.rows.length === 0) {
    addLine("No rows matched the current filters.", {
      font: "F1",
      size: 9,
      lineHeight: NORMAL_LINE_HEIGHT,
    });
  } else {
    for (const row of input.rows) {
      const line = buildTableLine(input.columns, row);
      for (const segment of splitTableLine(line)) {
        addLine(segment, {
          font: "F3",
          size: 8.5,
          lineHeight: TABLE_LINE_HEIGHT,
        });
      }
    }
  }

  flushPage();

  return pages;
}

function buildPdf(pages: PdfTextLine[][]) {
  const fontObjects = [
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>",
  ];

  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextId = 3;

  const helveticaId = nextId++;
  const helveticaBoldId = nextId++;
  const courierId = nextId++;
  const courierBoldId = nextId++;

  objects[helveticaId] = fontObjects[0];
  objects[helveticaBoldId] = fontObjects[1];
  objects[courierId] = fontObjects[2];
  objects[courierBoldId] = fontObjects[3];

  for (const page of pages) {
    const pageId = nextId++;
    const contentId = nextId++;
    pageObjectIds.push(pageId);
    contentObjectIds.push(contentId);

    const stream = page
      .map(
        (line) =>
          `BT /${line.font} ${line.size} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${escapePdfText(
            line.text
          )}) Tj ET`
      )
      .join("\n");

    objects[contentId] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${helveticaId} 0 R /F2 ${helveticaBoldId} 0 R /F3 ${courierId} 0 R /F4 ${courierBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  }

  objects[2] = `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (let id = 1; id < objects.length; id += 1) {
    if (!objects[id]) {
      continue;
    }

    offsets[id] = Buffer.byteLength(pdf, "utf8");
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let id = 1; id < objects.length; id += 1) {
    const offset = offsets[id] ?? 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

export function renderReportPdf(input: PdfReportInput) {
  const pages = buildPageTextLines(input);
  return buildPdf(pages);
}

export function formatReportGeneratedAt(date = new Date()) {
  return formatTimestamp(date);
}
