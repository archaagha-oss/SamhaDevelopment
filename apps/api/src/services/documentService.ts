import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  NoSuchKey,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { prisma } from "../lib/prisma";

// Validate S3 configuration at startup
const validateS3Config = () => {
  const required = ["AWS_S3_BUCKET", "AWS_S3_REGION", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing S3 configuration: ${missing.join(", ")}`);
  }
};

try {
  validateS3Config();
} catch (err) {
  console.error("[S3 Configuration Error]", err);
  if (process.env.NODE_ENV === "production") {
    process.exit(1);
  }
}

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  maxAttempts: 3,
});

export class DocumentService {
  async uploadFile(
    file: Express.Multer.File,
    dealId: string
  ): Promise<{ key: string; url: string }> {
    try {
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error("File buffer is empty");
      }

      const ext = path.extname(file.originalname);
      const timestamp = Date.now();
      const key = `deals/${dealId}/${timestamp}${ext}`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          "original-filename": file.originalname,
          "upload-timestamp": timestamp.toString(),
        },
      });

      await s3Client.send(command);

      const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_S3_REGION}.amazonaws.com/${key}`;

      console.log(`[S3 Upload Success] dealId=${dealId}, key=${key}, size=${file.size}B`);

      return { key, url };
    } catch (err: any) {
      console.error("[S3 Upload Error]", {
        dealId,
        filename: file.originalname,
        size: file.size,
        error: err.message,
      });

      if (err.name === "NoSuchBucket") {
        throw new Error("S3 bucket not found. Check AWS configuration.");
      }
      if (err.name === "InvalidAccessKeyId") {
        throw new Error("Invalid AWS credentials.");
      }
      throw new Error(`Failed to upload file: ${err.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      });

      await s3Client.send(command);
      console.log(`[S3 Delete Success] key=${key}`);
    } catch (err: any) {
      console.error("[S3 Delete Error]", { key, error: err.message });
      throw new Error(`Failed to delete file: ${err.message}`);
    }
  }

  async generatePresignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      if (expiresIn < 60 || expiresIn > 604800) {
        throw new Error("Expiry must be between 60 seconds and 7 days");
      }

      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });
      console.log(`[Presigned URL Generated] key=${key}, expiresIn=${expiresIn}s`);
      return url;
    } catch (err: any) {
      console.error("[Presigned URL Error]", { key, error: err.message });
      throw new Error(`Failed to generate download URL: ${err.message}`);
    }
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
