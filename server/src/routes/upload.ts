import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { env } from "../config/env";

// Allowed image types
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Upload directory (relative to server root)
const UPLOAD_DIR = join(process.cwd(), "uploads");

// Helper to build the correct URL for uploads
function buildUploadUrl(request: any, folder: string, filename: string): string {
  // If FRONTEND_URL is set, use it (for production)
  if (env.FRONTEND_URL && env.FRONTEND_URL !== "http://localhost:5173") {
    return `${env.FRONTEND_URL}/uploads/${folder}/${filename}`;
  }
  
  // Otherwise, build from request host
  const host = request.headers.host || "localhost:4000";
  const protocol = request.headers["x-forwarded-proto"] || request.protocol || "http";
  return `${protocol}://${host}/uploads/${folder}/${filename}`;
}

export async function uploadRoutes(fastify: FastifyInstance) {
  // Upload single image
  fastify.post<{
    Params: { folder: string };
  }>("/api/upload/:folder", async (request, reply) => {
    const { folder } = request.params;
    
    // Validate folder
    const allowedFolders = ["events", "venues", "categories", "users", "misc"];
    if (!allowedFolders.includes(folder)) {
      return reply.status(400).send({ error: "Invalid upload folder" });
    }

    try {
      // Get file from multipart
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const mimeType = data.mimetype;
      const originalName = data.filename || "upload";
      
      // Validate type
      if (!ALLOWED_TYPES.includes(mimeType)) {
        return reply.status(400).send({ 
          error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" 
        });
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Validate size
      if (fileBuffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({ 
          error: "File too large. Maximum size: 10MB" 
        });
      }

      // Generate unique filename
      const ext = extname(originalName) || ".jpg";
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
      const filePath = join(UPLOAD_DIR, folder, filename);

      // Save file
      await writeFile(filePath, fileBuffer);

      // Return full URL
      const url = buildUploadUrl(request, folder, filename);
      console.log(`[Upload] Generated URL: ${url}`);
      
      return reply.send({
        success: true,
        url,
        filename,
        size: fileBuffer.length,
        mimeType,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return reply.status(500).send({ error: "Failed to process upload" });
    }
  });

  // Upload multiple images
  fastify.post<{
    Params: { folder: string };
  }>("/api/upload/:folder/multiple", async (request, reply) => {
    const { folder } = request.params;
    
    const allowedFolders = ["events", "venues", "categories", "users", "misc"];
    if (!allowedFolders.includes(folder)) {
      return reply.status(400).send({ error: "Invalid upload folder" });
    }

    try {
      const parts = request.files();
      const results: Array<{ url: string; filename: string; size: number }> = [];
      const errors: string[] = [];

      for await (const part of parts) {
        try {
          const mimeType = part.mimetype;
          const originalName = part.filename || "upload";
          
          if (!ALLOWED_TYPES.includes(mimeType)) {
            errors.push(`${originalName}: Invalid file type`);
            continue;
          }

          // Read file buffer
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);

          if (fileBuffer.length > MAX_FILE_SIZE) {
            errors.push(`${originalName}: File too large`);
            continue;
          }

          const ext = extname(originalName) || ".jpg";
          const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
          const filePath = join(UPLOAD_DIR, folder, filename);

          await writeFile(filePath, fileBuffer);

          // Build full URL
          const url = buildUploadUrl(request, folder, filename);
          console.log(`[Upload Multiple] Generated URL: ${url}`);

          results.push({
            url,
            filename,
            size: fileBuffer.length,
          });
        } catch (err) {
          errors.push(`Failed to process file`);
        }
      }

      return reply.send({
        success: true,
        uploaded: results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("Upload error:", err);
      return reply.status(500).send({ error: "Failed to process uploads" });
    }
  });

  // Delete an uploaded file
  fastify.delete<{
    Params: { folder: string; filename: string };
  }>("/api/upload/:folder/:filename", async (request, reply) => {
    const { folder, filename } = request.params;
    
    const allowedFolders = ["events", "venues", "categories", "users", "misc"];
    if (!allowedFolders.includes(folder)) {
      return reply.status(400).send({ error: "Invalid folder" });
    }

    // Prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = join(UPLOAD_DIR, folder, filename);
    
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "File not found" });
    }

    try {
      await unlink(filePath);
      return reply.send({ success: true, message: "File deleted" });
    } catch (err) {
      console.error("Delete error:", err);
      return reply.status(500).send({ error: "Failed to delete file" });
    }
  });

  // Get upload info
  fastify.get("/api/upload/info", async (_request, reply) => {
    return reply.send({
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
      allowedTypes: ALLOWED_TYPES,
      allowedFolders: ["events", "venues", "categories", "users", "misc"],
    });
  });
}
