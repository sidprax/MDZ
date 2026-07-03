import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_STORE_DIR = ".mdz/store";

export function createHandle(id) {
  return `mdz://context/${id}`;
}

export function parseHandle(handle) {
  const value = String(handle ?? "");
  const prefix = "mdz://context/";
  if (!value.startsWith(prefix)) {
    throw new Error(`Invalid MDZ handle: ${value}`);
  }
  return value.slice(prefix.length);
}

export async function storeContext(content, options = {}) {
  const text = String(content ?? "");
  const id = createContentId(text);
  const storeDir = options.storeDir ?? DEFAULT_STORE_DIR;
  const objectPath = getObjectPath(storeDir, id);

  await mkdir(path.dirname(objectPath), { recursive: true });
  await writeFile(objectPath, text, "utf8");

  return {
    id,
    handle: createHandle(id),
    bytes: Buffer.byteLength(text, "utf8"),
    path: objectPath
  };
}

export async function expandContext(handle, options = {}) {
  const id = parseHandle(handle);
  const storeDir = options.storeDir ?? DEFAULT_STORE_DIR;
  const text = await readFile(getObjectPath(storeDir, id), "utf8");

  if (options.startLine || options.endLine) {
    return sliceLines(text, options.startLine, options.endLine);
  }

  return text;
}

export function createContentId(content) {
  return createHash("sha256").update(String(content ?? "")).digest("hex").slice(0, 24);
}

function getObjectPath(storeDir, id) {
  return path.join(storeDir, id.slice(0, 2), `${id}.txt`);
}

function sliceLines(text, startLine, endLine) {
  const lines = text.split(/\r?\n/);
  const start = Math.max(0, Number(startLine ?? 1) - 1);
  const end = Math.min(lines.length, Number(endLine ?? lines.length));
  return lines.slice(start, end).join("\n");
}
