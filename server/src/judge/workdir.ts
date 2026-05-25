import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function makeWorkdir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "toizero-"));
}

export async function cleanupWorkdir(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}
