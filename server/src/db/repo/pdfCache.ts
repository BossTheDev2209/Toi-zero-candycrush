import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function safeSlug(slug: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(slug)) throw new Error(`unsafe problem slug: ${slug}`);
  return slug;
}

export function pdfPath(root: string, slug: string): string {
  return join(root, safeSlug(slug), "statement.pdf");
}

export function hasPdf(root: string, slug: string): boolean {
  return existsSync(pdfPath(root, slug));
}

export function readPdf(root: string, slug: string): Uint8Array | null {
  const path = pdfPath(root, slug);
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

export function writePdfAtomic(root: string, slug: string, bytes: Uint8Array): void {
  const path = pdfPath(root, slug);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writeFileSync(tmp, bytes);
    renameSync(tmp, path);
  } catch (error) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* best effort cleanup */ }
    throw error;
  }
}
