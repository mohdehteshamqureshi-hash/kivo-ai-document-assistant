/**
 * Page-Aware PDF Parsing and Chunking Module for Kivo AI.
 * Extracts text page-by-page from binary PDF buffers and partitions it into
 * overlapping sliding-window passages preserving exact 1-indexed page numbers.
 *
 * Uses unpdf for serverless and edge-compatible PDF text extraction without
 * native binary addon dependencies (such as @napi-rs/canvas) or browser DOM globals.
 */

import { extractText } from "unpdf";

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

  // If plain text or markdown document, return immediately
  if (!isPdfHeader) {
    const rawString = buffer.toString("utf-8");
    return [{ pageNum: 1, text: rawString.trim() }];
  }

  try {
    const { text } = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pagesArray = Array.isArray(text) ? text : [text];

    return pagesArray.map((pageText, idx) => ({
      pageNum: idx + 1,
      text: (pageText || "").trim(),
    }));
  } catch (err) {
    throw new Error(`Failed to parse PDF document: ${err instanceof Error ? err.message : String(err)}`);
  }
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
