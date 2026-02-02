import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/PublicNavbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Music,
  Loader2,
  UserCircle,
  Disc3,
  Calendar,
  ChevronRight,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

interface Artist {
  id: string;
  name: string;
  slug: string;
  shortBio?: string;
  profileImage?: string;
  coverImage?: string;
  genres?: string[];
  eventsCount?: number;
  playlistsCount?: number;
}

export default function Artists() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<{ artists: Artist[] }>({
    queryKey: ["public-artists"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/artists?active=true`);
      if (!res.ok) throw new Error("Error loading artists");
      return res.json();
    },
  });

  const artists = data?.artists || [];

  // Filter artists by search query
  const filteredArtists = artists.filter((artist) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      artist.name.toLowerCase().includes(query) ||
      artist.shortBio?.toLowerCase().includes(query) ||
      artist.genres?.some((g) => g.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-[#050505]">
      <PublicNavbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-20 pb-12">
        <div className="absolute inset-0 bg-gradient-to-b from-[#ffc800]/10 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#ffc800]/5 via-transparent to-transparent" />
        
        <div className="container relative mx-auto px-4">
          <div className="text-center mb-8">
            <Badge className="mb-4 bg-[#ffc800]/20 text-[#ffc800] border-[#ffc800]/30">
              <Music className="mr-2 h-3 w-3" />
              Artistas
            </Badge>
            <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
              Descubre Artistas
            </h1>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Explora nuestro catálogo de artistas, descubre su música y encuentra sus próximos eventos
            </p>
          </div>

          {/* Search */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                placeholder="Buscar artistas por nombre o género..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-12 pr-4 text-lg border-white/20 bg-white/5 text-white placeholder:text-white/40 rounded-2xl focus:border-[#ffc800]/50 focus:ring-[#ffc800]/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Artists Grid */}
      <div className="container mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ffc800]" />
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <UserCircle className="h-16 w-16 text-white/20 mb-4" />
            <h3 className="text-xl font-medium text-white">No se encontraron artistas</h3>
            <p className="text-white/50 mt-2">
              {searchQuery ? "Intenta con otra búsqueda" : "No hay artistas disponibles"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredArtists.map((artist) => (
              <Link key={artist.id} to={`/artista/${artist.slug}`}>
                <Card className="group h-full overflow-hidden border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#ffc800]/30 transition-all duration-300">
                  {/* Cover Image */}
                  <div className="relative aspect-square overflow-hidden">
                    {artist.profileImage || artist.coverImage ? (
                      <img
                        src={artist.profileImage || artist.coverImage}
                        alt={artist.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffc800]/20 to-amber-500/20">
                        <UserCircle className="h-24 w-24 text-white/20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    {/* Genres */}
                    {artist.genres && artist.genres.length > 0 && (
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                        {artist.genres.slice(0, 2).map((genre, idx) => (
                          <Badge
                            key={idx}
                            className="bg-black/50 text-white/90 border-0 text-xs backdrop-blur-sm"
                          >
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Quick Stats */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
                      {artist.eventsCount !== undefined && artist.eventsCount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-white/80">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{artist.eventsCount} eventos</span>
                        </div>
                      )}
                      {artist.playlistsCount !== undefined && artist.playlistsCount > 0 && (
                        <div className="flex items-center gap-1 text-xs text-white/80">
                          <Disc3 className="h-3.5 w-3.5" />
                          <span>{artist.playlistsCount} playlists</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-white text-lg group-hover:text-[#ffc800] transition-colors">
                          {artist.name}
                        </h3>
                        {artist.shortBio && (
                          <p className="text-sm text-white/50 line-clamp-2 mt-1">
                            {artist.shortBio}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/30 group-hover:text-[#ffc800] group-hover:translate-x-1 transition-all" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-white/50">
          <p>© 2025 Boletera. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
