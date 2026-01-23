import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to generate slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Helper to parse JSON fields and expand socialLinks
function parseArtist(artist: any) {
  if (!artist) return artist;
  
  const socialLinks = artist.socialLinks ? JSON.parse(artist.socialLinks) : {};
  const genres = artist.genres ? JSON.parse(artist.genres) : [];
  const achievements = artist.achievements ? JSON.parse(artist.achievements) : [];
  const galleryImages = artist.galleryImages ? JSON.parse(artist.galleryImages) : [];

  return {
    ...artist,
    genres,
    achievements,
    galleryImages,
    socialLinks,
    // Expand socialLinks to individual fields for frontend compatibility
    website: socialLinks.website || "",
    spotifyUrl: socialLinks.spotify || "",
    instagramUrl: socialLinks.instagram || "",
    facebookUrl: socialLinks.facebook || "",
    twitterUrl: socialLinks.twitter || "",
    youtubeUrl: socialLinks.youtube || "",
    tiktokUrl: socialLinks.tiktok || "",
  };
}

export async function artistsRoutes(fastify: FastifyInstance) {
  // GET all artists
  fastify.get("/api/artists", async (request, reply) => {
    const { active, featured, search, limit = "50", offset = "0" } = request.query as any;

    const where: any = {};
    
    if (active === "true") where.isActive = true;
    if (active === "false") where.isActive = false;
    if (featured === "true") where.isFeatured = true;
    
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { bio: { contains: search } },
      ];
    }

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        where,
        orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
        take: parseInt(limit),
        skip: parseInt(offset),
        include: {
          _count: {
            select: { events: true, playlists: true }
          }
        }
      }),
      prisma.artist.count({ where }),
    ]);

    // Parse JSON fields for each artist
    const parsedArtists = artists.map(parseArtist);

    return reply.send({ artists: parsedArtists, total });
  });

  // GET single artist by id or slug
  fastify.get<{ Params: { idOrSlug: string } }>("/api/artists/:idOrSlug", async (request, reply) => {
    const { idOrSlug } = request.params;

    const artist = await prisma.artist.findFirst({
      where: {
        OR: [
          { id: idOrSlug },
          { slug: idOrSlug },
        ],
      },
      include: {
        playlists: {
          where: { isActive: true, isPublic: true },
          include: {
            tracks: {
              where: { isActive: true },
              orderBy: { trackNumber: "asc" },
            },
          },
        },
        events: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            venue: { select: { name: true, city: true } },
            sessions: { orderBy: { startsAt: "asc" }, take: 1 },
          },
        },
        _count: {
          select: { events: true, playlists: true }
        }
      },
    });

    if (!artist) {
      return reply.status(404).send({ error: "Artist not found" });
    }

    return reply.send(parseArtist(artist));
  });

  // CREATE artist (admin)
  fastify.post("/api/artists", async (request, reply) => {
    const body = request.body as any;

    const slug = body.slug || generateSlug(body.name);

    // Check slug uniqueness
    const existing = await prisma.artist.findUnique({ where: { slug } });
    if (existing) {
      return reply.status(400).send({ error: "Artist slug already exists" });
    }

    // Build socialLinks JSON from individual fields
    const socialLinks = JSON.stringify({
      website: body.website || null,
      spotify: body.spotifyUrl || null,
      instagram: body.instagramUrl || null,
      facebook: body.facebookUrl || null,
      twitter: body.twitterUrl || null,
      youtube: body.youtubeUrl || null,
      tiktok: body.tiktokUrl || null,
    });

    // Genres as JSON string
    const genres = body.genres ? JSON.stringify(body.genres) : null;
    const achievements = body.achievements ? JSON.stringify(body.achievements) : null;

    const artist = await prisma.artist.create({
      data: {
        name: body.name,
        slug,
        bio: body.bio,
        shortBio: body.shortBio,
        profileImage: body.profileImage,
        coverImage: body.coverImage,
        galleryImages: body.galleryImages ? JSON.stringify(body.galleryImages) : null,
        socialLinks,
        genres,
        achievements,
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
      },
    });

    return reply.status(201).send(parseArtist(artist));
  });

  // UPDATE artist
  fastify.put<{ Params: { id: string } }>("/api/artists/:id", async (request, reply) => {
    const { id } = request.params;
    const body = request.body as any;

    // Check if artist exists
    const existing = await prisma.artist.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Artist not found" });
    }

    // Check slug uniqueness if changed
    if (body.slug && body.slug !== existing.slug) {
      const slugExists = await prisma.artist.findUnique({ where: { slug: body.slug } });
      if (slugExists) {
        return reply.status(400).send({ error: "Slug already in use" });
      }
    }

    // Build socialLinks JSON from individual fields
    const socialLinks = JSON.stringify({
      website: body.website || null,
      spotify: body.spotifyUrl || null,
      instagram: body.instagramUrl || null,
      facebook: body.facebookUrl || null,
      twitter: body.twitterUrl || null,
      youtube: body.youtubeUrl || null,
      tiktok: body.tiktokUrl || null,
    });

    // Genres and achievements as JSON strings
    const genres = body.genres ? JSON.stringify(body.genres) : null;
    const achievements = body.achievements ? JSON.stringify(body.achievements) : null;

    const artist = await prisma.artist.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        bio: body.bio,
        shortBio: body.shortBio,
        profileImage: body.profileImage,
        coverImage: body.coverImage,
        galleryImages: body.galleryImages ? JSON.stringify(body.galleryImages) : null,
        socialLinks,
        genres,
        achievements,
        isActive: body.isActive,
        isFeatured: body.isFeatured,
      },
    });

    return reply.send(parseArtist(artist));
  });

  // DELETE artist
  fastify.delete<{ Params: { id: string } }>("/api/artists/:id", async (request, reply) => {
    const { id } = request.params;

    const existing = await prisma.artist.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ error: "Artist not found" });
    }

    await prisma.artist.delete({ where: { id } });

    return reply.send({ success: true });
  });
}
