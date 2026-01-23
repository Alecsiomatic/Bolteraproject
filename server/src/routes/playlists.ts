import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { env } from "../config/env";

const prisma = new PrismaClient();

// Upload directory for audio files
const UPLOAD_DIR = join(process.cwd(), "uploads");
const AUDIO_DIR = join(UPLOAD_DIR, "audio");

// Allowed audio types
const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg"];
const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 50MB

// Helper to generate slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Ensure audio directory exists
async function ensureAudioDir() {
  if (!existsSync(AUDIO_DIR)) {
    await mkdir(AUDIO_DIR, { recursive: true });
  }
}

export async function playlistsRoutes(fastify: FastifyInstance) {
  // GET all playlists
  fastify.get("/api/playlists", async (request, reply) => {
    const { active, public: isPublic, artistId, search, limit = "50", offset = "0" } = request.query as any;

    const where: any = {};
    
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (isPublic === "true") where.isPublic = true;
    if (artistId) where.artistId = artistId;
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [playlists, total] = await Promise.all([
      prisma.playlist.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          artist: { select: { id: true, name: true, profileImage: true } },
          _count: { select: { tracks: true } },
        },
      }),
      prisma.playlist.count({ where }),
    ]);

    return reply.send({ playlists, total });
  });

  // GET single playlist with tracks
  fastify.get<{ Params: { idOrSlug: string } }>("/api/playlists/:idOrSlug", async (request, reply) => {
    const { idOrSlug } = request.params;

    const playlist = await prisma.playlist.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        artist: { select: { id: true, name: true, slug: true, profileImage: true } },
        tracks: {
          where: { isActive: true },
          orderBy: { trackNumber: "asc" },
        },
      },
    });

    if (!playlist) {
      return reply.status(404).send({ error: "Playlist not found" });
    }

    return reply.send(playlist);
  });

  // CREATE playlist
  fastify.post("/api/playlists", async (request, reply) => {
    const body = request.body as any;

    const slug = body.slug || generateSlug(body.name);

    // Check slug uniqueness
    const existing = await prisma.playlist.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(400).send({ error: "Playlist slug already exists" });
    }

    const playlist = await prisma.playlist.create({
      data: {
        name: body.name,
        slug,
        description: body.description,
        coverImage: body.coverImage,
        artistId: body.artistId || null,
        isPublic: body.isPublic ?? true,
        isActive: body.isActive ?? true,
      },
      include: {
        artist: { select: { id: true, name: true } },
      },
    });

    return reply.status(201).send(playlist);
  });

  // UPDATE playlist
  fastify.put<{ Params: { id: string } }>("/api/playlists/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body as any;

    const existing = await prisma.playlist.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Playlist not found" });
    }

    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.playlist.findUnique({ where: { slug: body.slug } });
      if (slugExists) {
        return reply.status(400).send({ error: "Slug already in use" });
      }
    }

    const playlist = await prisma.playlist.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        coverImage: body.coverImage,
        artistId: body.artistId,
        isPublic: body.isPublic,
        isActive: body.isActive,
      },
      include: {
        artist: { select: { id: true, name: true } },
        tracks: { orderBy: { trackNumber: "asc" } },
      },
    });

    return reply.send(playlist);
  });

  // DELETE playlist
  fastify.delete<{ Params: { id: string } }>("/api/playlists/:id", async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.playlist.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Playlist not found" });
    }

    // Delete associated tracks files
    const tracks = await prisma.track.findMany({ where: { playlistId: id } });
    for (const track of tracks) {
      if (track.audioUrl) {
        try {
          const filePath = join(UPLOAD_DIR, track.audioUrl.replace(/^\/uploads\//, ""));
          if (existsSync(filePath)) {
            await unlink(filePath);
          }
        } catch (e) {
          console.error("Error deleting track file:", e);
        }
      }
    }

    await prisma.playlist.delete({ where: { id } });

    return reply.send({ success: true });
  });

  // =====================
  // TRACKS
  // =====================

  // ADD track to playlist
  fastify.post<{ Params: { playlistId: string } }>("/api/playlists/:playlistId/tracks", async (request, reply) => {
    const { playlistId } = request.params;
    const body = request.body as any;

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return reply.status(404).send({ error: "Playlist not found" });
    }

    // Get next track number
    const lastTrack = await prisma.track.findFirst({
      where: { playlistId },
      orderBy: { trackNumber: "desc" },
    });
    const nextNumber = (lastTrack?.trackNumber || 0) + 1;

    const track = await prisma.track.create({
      data: {
        playlistId,
        title: body.title,
        artistName: body.artistName,
        albumName: body.albumName,
        albumImage: body.albumImage,
        duration: body.duration ? parseInt(body.duration) : null,
        audioUrl: body.audioUrl,
        trackNumber: body.trackNumber ?? nextNumber,
        isActive: body.isActive ?? true,
      },
    });

    return reply.status(201).send(track);
  });

  // UPDATE track
  fastify.put<{ Params: { playlistId: string; trackId: string } }>("/api/playlists/:playlistId/tracks/:trackId", async (request, reply) => {
    const { playlistId, trackId } = request.params;
    const body = request.body as any;

    const track = await prisma.track.findFirst({
      where: { id: trackId, playlistId },
    });
    if (!track) {
      return reply.status(404).send({ error: "Track not found" });
    }

    const updated = await prisma.track.update({
      where: { id: trackId },
      data: {
        title: body.title,
        artistName: body.artistName,
        albumName: body.albumName,
        albumImage: body.albumImage,
        duration: body.duration ? parseInt(body.duration) : null,
        audioUrl: body.audioUrl,
        trackNumber: body.trackNumber,
        isActive: body.isActive,
      },
    });

    return reply.send(updated);
  });

  // DELETE track
  fastify.delete<{ Params: { playlistId: string; trackId: string } }>("/api/playlists/:playlistId/tracks/:trackId", async (request, reply) => {
    const { playlistId, trackId } = request.params;

    const track = await prisma.track.findFirst({
      where: { id: trackId, playlistId },
    });
    if (!track) {
      return reply.status(404).send({ error: "Track not found" });
    }

    // Delete audio file
    if (track.audioUrl) {
      try {
        const filePath = join(UPLOAD_DIR, track.audioUrl.replace(/^\/uploads\//, ""));
        if (existsSync(filePath)) {
          await unlink(filePath);
        }
      } catch (e) {
        console.error("Error deleting track file:", e);
      }
    }

    await prisma.track.delete({ where: { id: trackId } });

    return reply.send({ success: true });
  });

  // REORDER tracks
  fastify.put<{ Params: { playlistId: string } }>("/api/playlists/:playlistId/tracks/reorder", async (request, reply) => {
    const { playlistId } = request.params;
    const { trackIds } = request.body as { trackIds: string[] };

    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      return reply.status(404).send({ error: "Playlist not found" });
    }

    // Update each track's order
    await Promise.all(
      trackIds.map((id, index) =>
        prisma.track.update({
          where: { id },
          data: { trackNumber: index + 1 },
        })
      )
    );

    return reply.send({ success: true });
  });

  // UPLOAD audio file
  fastify.post("/api/upload/audio", async (request, reply) => {
    await ensureAudioDir();

    try {
      const data = await request.file();
      
      if (!data) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const mimeType = data.mimetype;
      const originalName = data.filename || "audio.mp3";
      
      // Validate type
      if (!ALLOWED_AUDIO_TYPES.includes(mimeType)) {
        return reply.status(400).send({ 
          error: "Invalid file type. Allowed: MP3, WAV, OGG" 
        });
      }

      // Read file buffer
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const fileBuffer = Buffer.concat(chunks);

      // Validate size
      if (fileBuffer.length > MAX_AUDIO_SIZE) {
        return reply.status(400).send({ 
          error: "File too large. Maximum size: 50MB" 
        });
      }

      // Generate unique filename
      const ext = extname(originalName) || ".mp3";
      const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
      const filePath = join(AUDIO_DIR, filename);

      // Save file
      await writeFile(filePath, fileBuffer);

      // Return URL using FRONTEND_URL for production
      let url: string;
      if (env.FRONTEND_URL && env.FRONTEND_URL !== "http://localhost:5173") {
        url = `${env.FRONTEND_URL}/uploads/audio/${filename}`;
      } else {
        const host = request.headers.host || "localhost:4000";
        const protocol = request.headers["x-forwarded-proto"] || request.protocol || "http";
        url = `${protocol}://${host}/uploads/audio/${filename}`;
      }
      
      return reply.send({
        success: true,
        url,
        filename,
        size: fileBuffer.length,
        mimeType,
      });
    } catch (error) {
      console.error("Audio upload error:", error);
      return reply.status(500).send({ error: "Upload failed" });
    }
  });
}
