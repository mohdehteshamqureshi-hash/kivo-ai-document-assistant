/**
 * Page-Aware PDF Parsing and Chunking Module for Kivo AI.
 * Extracts text page-by-page from binary PDF buffers and partitions it into
 * overlapping sliding-window passages preserving exact 1-indexed page numbers.
 */

import * as pdfParseModule from "pdf-parse";

export interface PageContent {
  pageNum: number;
  text: string;
}

export interface RawChunk {
  id: string;
  doc_id: string;
  doc_name: string;
  page: number;
  text: string;
}

/**
 * Extracts page-by-page text from binary PDF buffer.
 */
export async function extractPdfPages(buffer: Buffer): Promise<PageContent[]> {
  if (!buffer || buffer.length === 0) {
    return [];
  }

  const isPdfHeader = buffer.length >= 4 && buffer.slice(0, 4).toString() === "%PDF";

  try {
    // pdf-parse v2 provides the PDFParse class
    if (pdfParseModule.PDFParse) {
      const parser = new pdfParseModule.PDFParse({ data: buffer });
      const result = await parser.getText();
      if (result && Array.isArray(result.pages) && result.pages.length > 0) {
        return result.pages.map((p: { text?: string; num?: number }, idx: number) => ({
          pageNum: p.num || idx + 1,
          text: (p.text || "").trim(),
        }));
      }
      if (result && result.text) {
        return [{ pageNum: 1, text: result.text.trim() }];
      }
    }

    // pdf-parse v1 fallback if exported as direct function
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const directParser = typeof pdfParseModule === "function" ? pdfParseModule : (pdfParseModule as any).default;
    if (typeof directParser === "function") {
      const data = await directParser(buffer);
      return [{ pageNum: 1, text: (data.text || "").trim() }];
    }
  } catch (err) {
    if (isPdfHeader) {
      throw new Error(`Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fallback: If plain text or markdown document
  const rawString = buffer.toString("utf-8");
  return [{ pageNum: 1, text: rawString.trim() }];
}

/**
 * Partitions page text into sliding-window passages of 350 words with 50-word overlap,
 * exactly preserving the original page coordinates.
 */
export function chunkPages(
  pages: PageContent[],
  docId: string,
  docName: string,
  chunkSizeWords: number = 350,
  overlapWords: number = 50
): RawChunk[] {
  const chunks: RawChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const words = page.text.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) continue;

    if (words.length <= chunkSizeWords) {
      chunkIndex++;
      chunks.push({
        id: `chk_${docId}_${chunkIndex}`,
        doc_id: docId,
        doc_name: docName,
        page: page.pageNum,
        text: words.join(" "),
      });
      continue;
    }

    const step = Math.max(1, chunkSizeWords - overlapWords);
    for (let start = 0; start < words.length; start += step) {
      const chunkWords = words.slice(start, start + chunkSizeWords);
      if (chunkWords.length < 15 && start > 0) {
        // Skip tiny orphan tail chunks
        continue;
      }
      chunkIndex++;
      chunks.push({
        id: `chk_${docId}_${chunkIndex}`,
        doc_id: docId,
        doc_name: docName,
        page: page.pageNum,
        text: chunkWords.join(" "),
      });
      if (start + chunkSizeWords >= words.length) {
        break;
      }
    }
  }

  return chunks;
}
