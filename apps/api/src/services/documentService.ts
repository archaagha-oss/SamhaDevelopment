/**
 * Document storage service — LOCAL FILESYSTEM (dev mode)
 *
 * Files are stored under apps/api/uploads/ and served via the /uploads
 * static mount in index.ts. Vite proxies /uploads -> localhost:3000 in dev,
 * so the same URL works from the web app.
 *
 * To swap back to S3 later, replace this module with the original
 * @aws-sdk/client-s3 implementation. The DocumentService API surface
 * (uploadFile / deleteFile / generatePresignedUrl) is intentionally
 * identical so callers don't need to change.
 */
import fs from "fs/promises";
import path from "path";
import { prisma } from "../lib/prisma";

// Resolve uploads dir relative to apps/api, regardless of cwd.
// __dirname at runtime: apps/api/dist/services or src/services depending on tsx vs node.
// We anchor on apps/api by going up until we hit the package.json.
const UPLOADS_DIR = path.resolve(process.cwd().endsWith("apps/api") || process.cwd().endsWith("apps\\api")
  ? "uploads"
  : path.join("apps", "api", "uploads"));

// Public URL prefix served by Express. Must match the static mount in index.ts.
const PUBLIC_URL_PREFIX = "/uploads";

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export type UploadScope =
  | { scope: "deal"; id: string }
  | { scope: "project"; id: string };

export class DocumentService {
  async uploadFile(
    file: Express.Multer.File,
    target: UploadScope | string
  ): Promise<{ key: string; url: string }> {
    const scoped: UploadScope =
      typeof target === "string" ? { scope: "deal", id: target } : target;
    try {
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error("File buffer is empty");
      }

      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const prefix = scoped.scope === "deal" ? "deals" : "projects";

      // Key uses POSIX separators so it's portable in URLs and DB.
      const key = `${prefix}/${scoped.id}/${timestamp}${ext}`;

      const absDir = path.join(UPLOADS_DIR, prefix, scoped.id);
      const absPath = path.join(absDir, `${timestamp}${ext}`);

      await ensureDir(absDir);
      await fs.writeFile(absPath, file.buffer);

      const url = `${PUBLIC_URL_PREFIX}/${key}`;

      console.log(`[Local Upload Success] ${scoped.scope}=${scoped.id}, key=${key}, size=${file.size}B`);

      return { key, url };
    } catch (err: any) {
      console.error("[Local Upload Error]", {
        target: scoped,
        filename: file.originalname,
        size: file.size,
        error: err.message,
      });
      throw new Error(`Failed to upload file: ${err.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const absPath = path.join(UPLOADS_DIR, key);
      await fs.unlink(absPath).catch((err) => {
        // Treat "file not found" as success — the row may have been deleted
        // before the file, or the file was cleaned up out-of-band.
        if (err?.code === "ENOENT") return;
        throw err;
      });
      console.log(`[Local Delete Success] key=${key}`);
    } catch (err: any) {
      console.error("[Local Delete Error]", { key, error: err.message });
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }

  async generatePresignedUrl(
    key: string,
    _expiresIn: number = 3600
  ): Promise<string> {
    // Local files are served directly by Express. No signing needed.
    // We keep the same signature so callers don't need to change.
    return `${PUBLIC_URL_PREFIX}/${key}`;
  }
}

export const documentService = new DocumentService();

// ---------------------------------------------------------------------------
// createGeneratedDocument — creates a Document record without a file upload.
// Used for system-generated documents (offers, reservation forms, SPA drafts).
// ---------------------------------------------------------------------------

export interface GeneratedDocumentInput {
  type: "SALES_OFFER" | "RESERVATION_FORM" | "SPA";
  name: string;
  leadId?: string;
  dealId?: string;
  version?: number;
  dataSnapshot: object;
  createdBy: string;
}

export async function createGeneratedDocument(input: GeneratedDocumentInput) {
  const { type, name, leadId, dealId, dataSnapshot, createdBy } = input;

  // Auto-increment version for same type within same lead/deal scope
  const existing = await prisma.document.count({
    where: {
      type: type as any,
      source: "GENERATED",
      ...(leadId ? { leadId } : {}),
      ...(dealId ? { dealId } : {}),
      softDeleted: false,
    },
  });
  const version = existing + 1;

  return prisma.document.create({
    data: {
      type: type as any,
      source: "GENERATED",
      name,
      version,
      dataSnapshot,
      leadId: leadId ?? null,
      dealId: dealId ?? null,
      uploadedBy: createdBy,
    },
  });
}
