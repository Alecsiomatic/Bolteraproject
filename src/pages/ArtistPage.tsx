import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PublicNavbar } from "@/components/PublicNavbar";
import PrismaticBurst from "@/components/PrismaticBurst";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMusicStore } from "@/stores/musicStore";
import {
  Music,
  Calendar,
  MapPin,
  Play,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Loader2,
  ExternalLink,
  Disc3,
  Ticket,
  ChevronRight,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Artist {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  shortBio?: string;
  profileImage?: string;
  coverImage?: string;
  galleryImages?: string[];
  website?: string;
  spotifyUrl?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  genres?: string[];
  origin?: string;
  formedYear?: number;
  achievements?: string[];
  playlists?: Playlist[];
  events?: Event[];
}

interface Playlist {
  id: string;
  name: string;
  coverImage?: string;
  tracks: Track[];
}

interface Track {
  id: string;
  title: string;
  artistName?: string;
  albumImage?: string;
  audioUrl: string;
  duration?: number;
}

interface Event {
  id: string;
  name: string;
  slug: string;
  coverImage?: string;
  venue?: { name: string; city?: string };
  sessions?: { startsAt: string }[];
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function ArtistPage() {
  const { slug } = useParams<{ slug: string }>();
  const { setPlaylist, setTrack, currentTrack, isPlaying, togglePlay } = useMusicStore();

  const { data: artist, isLoading, error } = useQuery<Artist>({
    queryKey: ["artist", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/artists/${slug}`);
      if (!res.ok) throw new Error("Artist not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const handlePlayPlaylist = (playlist: Playlist, trackIndex = 0) => {
    setPlaylist({
      id: playlist.id,
      name: playlist.name,
      coverImage: playlist.coverImage,
      tracks: playlist.tracks.map(t => ({
        id: t.id,
        title: t.title,
        artistName: t.artistName || artist?.name,
        albumImage: t.albumImage || playlist.coverImage,
        audioUrl: t.audioUrl,
        duration: t.duration,
      })),
    }, trackIndex);
  };

  const handlePlayTrack = (track: Track, playlist: Playlist) => {
    const index = playlist.tracks.findIndex(t => t.id === track.id);
    handlePlayPlaylist(playlist, index);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-gold-400" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-[#050505]">
        <PublicNavbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <Music className="h-20 w-20 text-gold-400/30 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Artista no encontrado</h1>
          <p className="text-white/60 mb-8">El artista que buscas no existe</p>
          <Button asChild className="bg-gold-500 text-black hover:bg-gold-400">
            <Link to="/events">Ver eventos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Background */}
      <div className="fixed inset-0 z-0">
        <PrismaticBurst
          colors={['#000000', '#ffc800', '#ffe566']}
          animationType="rotate3d"
          intensity={1.2}
          speed={0.5}
          className="w-full h-full opacity-50"
        />
      </div>

      <PublicNavbar variant="transparent" />

      {/* Hero Section */}
      <section className="relative pt-16">
        {/* Cover Image */}
        <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
          {artist.coverImage ? (
            <img
              src={artist.coverImage}
              alt={artist.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gold-500/20 to-amber-500/10" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/50 to-transparent" />
        </div>

        {/* Artist Info */}
        <div className="relative z-10 container mx-auto px-4 -mt-40">
          <div className="flex flex-col md:flex-row gap-8 items-end md:items-end">
            {/* Profile Image */}
            <div className="relative">
              {artist.profileImage ? (
                <img
                  src={artist.profileImage}
                  alt={artist.name}
                  className="h-48 w-48 rounded-2xl object-cover shadow-2xl shadow-black/50 border-4 border-[#050505]"
                />
              ) : (
                <div className="h-48 w-48 rounded-2xl bg-gradient-to-br from-gold-500/30 to-amber-500/20 flex items-center justify-center shadow-2xl border-4 border-[#050505]">
                  <Music className="h-20 w-20 text-gold-400" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {(artist.genres || []).map((genre) => (
                  <Badge key={genre} className="bg-gold-500/20 text-gold-400 border-0">
                    {genre}
                  </Badge>
                ))}
              </div>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">{artist.name}</h1>
              {artist.origin && (
                <p className="text-white/60 text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {artist.origin}
                  {artist.formedYear && ` • Desde ${artist.formedYear}`}
                </p>
              )}

              {/* Social Links */}
              <div className="flex flex-wrap gap-3 mt-4">
                {artist.spotifyUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-green-500/30 text-green-400 hover:bg-green-500/10"
                  >
                    <a href={artist.spotifyUrl} target="_blank" rel="noopener">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 mr-2 fill-current">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      Spotify
                    </a>
                  </Button>
                )}
                {artist.youtubeUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <a href={artist.youtubeUrl} target="_blank" rel="noopener">
                      <Youtube className="h-4 w-4 mr-2" />
                      YouTube
                    </a>
                  </Button>
                )}
                {artist.instagramUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10"
                  >
                    <a href={artist.instagramUrl} target="_blank" rel="noopener">
                      <Instagram className="h-4 w-4 mr-2" />
                      Instagram
                    </a>
                  </Button>
                )}
                {artist.facebookUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <a href={artist.facebookUrl} target="_blank" rel="noopener">
                      <Facebook className="h-4 w-4 mr-2" />
                      Facebook
                    </a>
                  </Button>
                )}
                {artist.website && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-gold-500/30 text-gold-400 hover:bg-gold-500/10"
                  >
                    <a href={artist.website} target="_blank" rel="noopener">
                      <Globe className="h-4 w-4 mr-2" />
                      Sitio web
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 py-12 space-y-16">
        {/* Bio */}
        {artist.bio && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="h-8 w-1 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full" />
              Biografía
            </h2>
            <div
              className="prose prose-invert max-w-none"
              style={{
                background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(20,20,20,0.4) 100%)',
                backdropFilter: 'blur(20px)',
                borderRadius: '1.5rem',
                padding: '2rem',
                border: '1px solid rgba(255, 200, 0, 0.1)',
              }}
            >
              <p className="text-white/80 text-lg leading-relaxed whitespace-pre-line">
                {artist.bio}
              </p>
            </div>
          </section>
        )}

        {/* Playlists / Music */}
        {artist.playlists && artist.playlists.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="h-8 w-1 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full" />
              Música
            </h2>
            <div className="space-y-8">
              {artist.playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(20,20,20,0.4) 100%)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 200, 0, 0.1)',
                  }}
                >
                  {/* Playlist Header */}
                  <div className="flex items-center gap-4 p-4 border-b border-gold-500/10">
                    {playlist.coverImage ? (
                      <img
                        src={playlist.coverImage}
                        alt={playlist.name}
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-gold-500/20 flex items-center justify-center">
                        <Disc3 className="h-8 w-8 text-gold-400" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white">{playlist.name}</h3>
                      <p className="text-white/50">{playlist.tracks.length} canciones</p>
                    </div>
                    <Button
                      onClick={() => handlePlayPlaylist(playlist)}
                      className="h-12 w-12 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-black hover:from-yellow-300 hover:to-amber-400 shadow-lg shadow-gold-500/30"
                    >
                      <Play className="h-5 w-5 ml-0.5" />
                    </Button>
                  </div>

                  {/* Tracks */}
                  <div className="divide-y divide-gold-500/5">
                    {playlist.tracks.slice(0, 5).map((track, index) => {
                      const isCurrentTrack = currentTrack?.id === track.id;
                      
                      return (
                        <div
                          key={track.id}
                          onClick={() => handlePlayTrack(track, playlist)}
                          className="flex items-center gap-4 p-4 hover:bg-gold-500/5 cursor-pointer transition-colors group"
                        >
                          <span className="w-6 text-center text-white/40 group-hover:hidden">
                            {index + 1}
                          </span>
                          <Play className="w-6 h-4 text-gold-400 hidden group-hover:block" />
                          
                          {track.albumImage ? (
                            <img
                              src={track.albumImage}
                              alt={track.title}
                              className="h-10 w-10 rounded object-cover"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gold-500/10 flex items-center justify-center">
                              <Music className="h-4 w-4 text-gold-400" />
                            </div>
                          )}
                          
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium truncate ${isCurrentTrack ? "text-gold-400" : "text-white"}`}>
                              {track.title}
                            </p>
                            <p className="text-sm text-white/50 truncate">
                              {track.artistName || artist.name}
                            </p>
                          </div>
                          
                          {track.duration && (
                            <span className="text-white/40 text-sm">
                              {formatDuration(track.duration)}
                            </span>
                          )}
                          
                          {isCurrentTrack && isPlaying && (
                            <div className="flex items-end gap-0.5">
                              <div className="w-0.5 h-3 bg-gold-400 animate-pulse rounded-full" />
                              <div className="w-0.5 h-4 bg-gold-400 animate-pulse rounded-full" style={{ animationDelay: "150ms" }} />
                              <div className="w-0.5 h-2 bg-gold-400 animate-pulse rounded-full" style={{ animationDelay: "300ms" }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events */}
        {artist.events && artist.events.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <div className="h-8 w-1 bg-gradient-to-b from-yellow-400 to-amber-500 rounded-full" />
              Próximos Eventos
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {artist.events.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.slug || event.id}`}
                  className="group"
                >
                  <Card className="overflow-hidden border-gold-500/20 bg-black/40 backdrop-blur-sm hover:border-gold-500/40 transition-all hover:shadow-lg hover:shadow-gold-500/10">
                    <div className="relative h-40 overflow-hidden">
                      {event.coverImage ? (
                        <img
                          src={event.coverImage}
                          alt={event.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-110"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-gold-500/20 to-amber-500/10 flex items-center justify-center">
                          <Ticket className="h-12 w-12 text-gold-400/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-bold text-white mb-2 line-clamp-1 group-hover:text-gold-400 transition-colors">
                        {event.name}
                      </h3>
                      {event.sessions?.[0] && (
                        <p className="text-sm text-white/60 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gold-400" />
                          {formatDate(event.sessions[0].startsAt)}
                        </p>
                      )}
                      {event.venue && (
                        <p className="text-sm text-white/60 flex items-center gap-2 mt-1">
                          <MapPin className="h-4 w-4 text-gold-400" />
                          {event.venue.name}
                          {event.venue.city && `, ${event.venue.city}`}
                        </p>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-3 w-full text-gold-400 hover:bg-gold-500/10"
                      >
                        Ver evento
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-gold-500/10 py-8">
        <div className="container mx-auto px-4 text-center text-white/40 text-sm">
          <p>© 2026 compratuboleto.mx. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
