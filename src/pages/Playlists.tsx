import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/PublicNavbar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMusicStore } from "@/stores/musicStore";
import {
  Search,
  Music,
  Loader2,
  ListMusic,
  Play,
  Pause,
  UserCircle,
  Disc3,
  Clock,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Track {
  id: string;
  title: string;
  artistName?: string;
  audioUrl: string;
  duration?: number;
}

interface Playlist {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  artist?: {
    id: string;
    name: string;
    slug: string;
    profileImage?: string;
  };
  tracks?: Track[];
  trackCount?: number;
  _count?: {
    tracks: number;
  };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function Playlists() {
  const [searchQuery, setSearchQuery] = useState("");
  const { setPlaylist, currentTrack, isPlaying, togglePlay } = useMusicStore();

  const { data, isLoading } = useQuery<{ playlists: Playlist[] }>({
    queryKey: ["public-playlists"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/playlists?active=true&public=true`);
      if (!res.ok) throw new Error("Error loading playlists");
      return res.json();
    },
  });

  const playlists = data?.playlists || [];

  // Filter playlists by search query
  const filteredPlaylists = playlists.filter((playlist) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      playlist.name.toLowerCase().includes(query) ||
      playlist.description?.toLowerCase().includes(query) ||
      playlist.artist?.name.toLowerCase().includes(query)
    );
  });

  const handlePlayPlaylist = (playlist: Playlist, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (playlist.tracks && playlist.tracks.length > 0) {
      const musicPlaylist = {
        id: playlist.id,
        name: playlist.name,
        coverImage: playlist.coverImage,
        tracks: playlist.tracks.map((t) => ({
          id: t.id,
          title: t.title,
          artistName: t.artistName || playlist.artist?.name || "Artista",
          audioUrl: t.audioUrl,
          albumImage: playlist.coverImage,
          duration: t.duration,
        })),
      };
      setPlaylist(musicPlaylist);
    }
  };

  const isPlaylistPlaying = (playlist: Playlist) => {
    return (
      isPlaying &&
      playlist.tracks?.some((t) => t.id === currentTrack?.id)
    );
  };

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
              <ListMusic className="mr-2 h-3 w-3" />
              Playlists
            </Badge>
            <h1 className="text-4xl font-bold text-white md:text-5xl lg:text-6xl">
              Playlists de Artistas
            </h1>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              Escucha las playlists creadas por nuestros artistas y prepárate para sus eventos
            </p>
          </div>

          {/* Search */}
          <div className="max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
              <Input
                placeholder="Buscar playlists o artistas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-14 pl-12 pr-4 text-lg border-white/20 bg-white/5 text-white placeholder:text-white/40 rounded-2xl focus:border-[#ffc800]/50 focus:ring-[#ffc800]/20"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Playlists Grid */}
      <div className="container mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#ffc800]" />
          </div>
        ) : filteredPlaylists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ListMusic className="h-16 w-16 text-white/20 mb-4" />
            <h3 className="text-xl font-medium text-white">No se encontraron playlists</h3>
            <p className="text-white/50 mt-2">
              {searchQuery ? "Intenta con otra búsqueda" : "No hay playlists disponibles"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredPlaylists.map((playlist) => (
              <Card 
                key={playlist.id} 
                className="group h-full overflow-hidden border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#ffc800]/30 transition-all duration-300"
              >
                {/* Cover Image */}
                <div className="relative aspect-square overflow-hidden">
                  {playlist.coverImage ? (
                    <img
                      src={playlist.coverImage}
                      alt={playlist.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#ffc800]/20 to-amber-500/20">
                      <Disc3 className="h-24 w-24 text-white/20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Play Button Overlay */}
                  <button
                    onClick={(e) => handlePlayPlaylist(playlist, e)}
                    className="absolute bottom-4 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ffc800] text-black shadow-lg shadow-[#ffc800]/30 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-110"
                  >
                    {isPlaylistPlaying(playlist) ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="h-6 w-6 ml-1" />
                    )}
                  </button>

                  {/* Track Count */}
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-black/50 text-white/90 border-0 text-xs backdrop-blur-sm">
                      <Music className="h-3 w-3 mr-1" />
                      {playlist._count?.tracks || playlist.trackCount || playlist.tracks?.length || 0} tracks
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <h3 className="font-semibold text-white text-lg line-clamp-1 group-hover:text-[#ffc800] transition-colors">
                    {playlist.name}
                  </h3>
                  
                  {playlist.artist && (
                    <Link 
                      to={`/artista/${playlist.artist.slug}`}
                      className="flex items-center gap-2 mt-2 group/artist"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {playlist.artist.profileImage ? (
                        <img
                          src={playlist.artist.profileImage}
                          alt={playlist.artist.name}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <UserCircle className="h-6 w-6 text-white/40" />
                      )}
                      <span className="text-sm text-white/60 group-hover/artist:text-[#ffc800] transition-colors">
                        {playlist.artist.name}
                      </span>
                    </Link>
                  )}

                  {playlist.description && (
                    <p className="text-sm text-white/40 line-clamp-2 mt-2">
                      {playlist.description}
                    </p>
                  )}
                </CardContent>
              </Card>
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
