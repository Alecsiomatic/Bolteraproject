import { useEffect, useRef, useState } from 'react';
import { useMusicStore, Track as StoreTrack } from '@/stores/musicStore';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Music,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface PlaylistTrack {
  id: string;
  title: string;
  artistName?: string;
  duration: number;
  audioUrl: string;
  coverUrl?: string;
  albumImage?: string;
  order: number;
}

interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  isActive: boolean;
  isPublic: boolean;
  tracks?: PlaylistTrack[];
  _count?: {
    tracks: number;
  };
}

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(0.7);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none');
  const [isShuffled, setIsShuffled] = useState(false);

  const {
    currentTrack,
    currentPlaylist,
    isPlaying,
    volume,
    progress,
    queue,
    setTrack,
    setPlaylist,
    togglePlay,
    setVolume,
    setProgress,
    next,
    previous,
    showPlayer,
  } = useMusicStore();

  // Fetch available playlists (all playlists that are active, regardless of public status for admin use)
  const { data: playlistsData } = useQuery<{ playlists: Playlist[]; total: number }>({
    queryKey: ['playlists', 'for-player'],
    queryFn: async () => {
      // Fetch all active playlists - the admin creates them for users to listen
      const response = await fetch(`${API_BASE_URL}/api/playlists?active=true`);
      if (!response.ok) throw new Error('Failed to fetch playlists');
      return response.json();
    },
  });

  const playlists = playlistsData?.playlists || [];

  // Fetch playlist tracks when selected
  const { data: playlistDetail } = useQuery<Playlist>({
    queryKey: ['playlist', currentPlaylist?.id],
    queryFn: async () => {
      if (!currentPlaylist?.id) return null;
      const response = await fetch(`${API_BASE_URL}/api/playlists/${currentPlaylist.id}`);
      if (!response.ok) throw new Error('Failed to fetch playlist');
      return response.json();
    },
    enabled: !!currentPlaylist?.id,
  });

  // Audio element effects
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
    };

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        next();
      }
    };

    const handleLoadedMetadata = () => {
      // Update duration if needed
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [setProgress, next, repeatMode]);

  // Play/pause effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Volume effect
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  // Load new track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.audioUrl) return;

    audio.src = currentTrack.audioUrl;
    audio.load();
    if (isPlaying) {
      audio.play().catch(console.error);
    }
  }, [currentTrack?.audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setProgress(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    if (value[0] === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
      setPreviousVolume(value[0]);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handlePlaylistSelect = async (playlist: Playlist) => {
    // Fetch and set the playlist
    try {
      const response = await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}`);
      if (!response.ok) throw new Error('Failed to fetch playlist');
      const fullPlaylist = await response.json();
      
      if (fullPlaylist.tracks && fullPlaylist.tracks.length > 0) {
        // Convert to store format
        const storePlaylist = {
          id: fullPlaylist.id,
          name: fullPlaylist.name,
          coverImage: fullPlaylist.coverImage || fullPlaylist.coverUrl,
          tracks: fullPlaylist.tracks.map((t: PlaylistTrack): StoreTrack => ({
            id: t.id,
            title: t.title,
            artistName: t.artistName,
            audioUrl: t.audioUrl,
            duration: t.duration,
            albumImage: t.albumImage || t.coverUrl, // Support both field names
          })),
        };
        setPlaylist(storePlaylist);
        showPlayer();
      }
    } catch (error) {
      console.error('Error loading playlist:', error);
    }
  };

  const handleTrackSelect = (track: StoreTrack) => {
    setTrack(track);
  };

  const cycleRepeatMode = () => {
    if (repeatMode === 'none') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('none');
  };

  const trackDuration = currentTrack?.duration || 0;
  const progressPercent = trackDuration > 0 ? (progress / trackDuration) * 100 : 0;

  // Always show player when there are playlists available (for discovery) or current track/playlist
  const hasContent = playlists.length > 0 || currentTrack || currentPlaylist;

  return (
    <>
      {/* Hidden audio element - always present */}
      <audio ref={audioRef} preload="metadata" />

      {/* Spacer to prevent content from being hidden behind player */}
      <div className={cn(
        "transition-all duration-300",
        !hasContent ? "h-0" : isExpanded ? "h-0" : "h-[72px] md:h-20"
      )} />

      {/* Player UI */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ease-out',
          !hasContent && 'translate-y-full',
          isExpanded ? 'h-screen md:h-96' : 'h-auto'
        )}
      >
        {/* Background - reduced blur on mobile for performance */}
        <div className={cn(
          "absolute inset-0 border-t transition-colors duration-300",
          isExpanded 
            ? "bg-black border-transparent" 
            : "bg-black/98 md:bg-black/90 md:backdrop-blur-xl border-white/5"
        )} />

        {/* Main content */}
        <div className="relative h-full flex flex-col">
          {/* Expanded view - Queue (Desktop only) */}
          {isExpanded && (
            <div className="hidden md:block flex-1 overflow-y-auto px-4 py-3 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[#ffc800] font-semibold flex items-center gap-2">
                  <ListMusic className="w-4 h-4" />
                  Cola de reproducción
                </h3>
                {currentPlaylist && (
                  <span className="text-white/60 text-sm">
                    {currentPlaylist.name}
                  </span>
                )}
              </div>
              
              {queue.length > 0 ? (
                queue.map((track, index) => (
                  <button
                    key={track.id}
                    onClick={() => handleTrackSelect(track)}
                    className={cn(
                      'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
                      currentTrack?.id === track.id
                        ? 'bg-[#ffc800]/20 text-[#ffc800]'
                        : 'hover:bg-white/10 text-white/80'
                    )}
                  >
                    <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center overflow-hidden">
                      {track.albumImage ? (
                        <img
                          src={track.albumImage}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-5 h-5 text-[#ffc800]/50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-medium">{track.title}</p>
                      <p className="text-sm opacity-60 truncate">
                        {track.artistName || 'Artista desconocido'}
                      </p>
                    </div>
                    <span className="text-sm opacity-60">
                      {formatTime(track.duration || 0)}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center text-white/40 py-8">
                  <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No hay canciones en la cola</p>
                  <p className="text-sm mt-1">Selecciona una playlist para comenzar</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== MOBILE PLAYER (Premium Minimal) ==================== */}
          <div className="md:hidden">
            {/* Expanded Full Screen Player */}
            {isExpanded && currentTrack && (
              <div className="h-screen flex flex-col px-6 pt-safe-top pb-8">
                {/* Header */}
                <div className="flex items-center justify-between py-4">
                  <button 
                    onClick={() => setIsExpanded(false)}
                    className="w-10 h-10 flex items-center justify-center text-white/60 active:scale-90 transition-transform"
                  >
                    <ChevronDown className="w-7 h-7" />
                  </button>
                  <span className="text-white/40 text-xs uppercase tracking-widest font-medium">
                    Reproduciendo
                  </span>
                  <div className="w-10" />
                </div>

                {/* Album Art - Large */}
                <div className="flex-1 flex items-center justify-center py-6">
                  <div className="w-full max-w-[320px] aspect-square rounded-2xl bg-neutral-900 shadow-2xl shadow-black/50 overflow-hidden">
                    {currentTrack.albumImage ? (
                      <img 
                        src={currentTrack.albumImage} 
                        alt={currentTrack.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900">
                        <Music className="w-24 h-24 text-[#ffc800]/30" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Track Info */}
                <div className="text-center mb-6">
                  <h2 className="text-white text-xl font-semibold truncate px-4">
                    {currentTrack.title}
                  </h2>
                  <p className="text-white/50 text-base mt-1">
                    {currentTrack.artistName || 'Artista desconocido'}
                  </p>
                </div>

                {/* Progress */}
                <div className="mb-6">
                  <Slider
                    value={[progress]}
                    max={trackDuration}
                    step={1}
                    onValueChange={handleSeek}
                    className="w-full [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_.bg-primary]:bg-white [&_[data-disabled]]:opacity-50"
                  />
                  <div className="flex justify-between mt-2 text-xs text-white/40 font-medium">
                    <span>{formatTime(progress)}</span>
                    <span>{formatTime(trackDuration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-6 mb-8">
                  <button
                    onClick={() => setIsShuffled(!isShuffled)}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center transition-all active:scale-90",
                      isShuffled ? "text-[#ffc800]" : "text-white/40"
                    )}
                  >
                    <Shuffle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={previous}
                    className="w-14 h-14 flex items-center justify-center text-white active:scale-90 transition-transform"
                  >
                    <SkipBack className="w-8 h-8" fill="currentColor" />
                  </button>
                  <button
                    onClick={togglePlay}
                    className="w-18 h-18 bg-white rounded-full flex items-center justify-center text-black active:scale-95 transition-transform shadow-lg"
                    style={{ width: 72, height: 72 }}
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8" fill="currentColor" />
                    ) : (
                      <Play className="w-8 h-8 ml-1" fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={next}
                    className="w-14 h-14 flex items-center justify-center text-white active:scale-90 transition-transform"
                  >
                    <SkipForward className="w-8 h-8" fill="currentColor" />
                  </button>
                  <button
                    onClick={cycleRepeatMode}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center transition-all active:scale-90",
                      repeatMode !== 'none' ? "text-[#ffc800]" : "text-white/40"
                    )}
                  >
                    {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Mini Player Bar */}
            {!isExpanded && (
              <div className="relative">
                {/* Ultra-thin progress indicator */}
                {currentTrack && (
                  <div className="absolute top-0 left-0 right-0 h-[3px] bg-white/10">
                    <div 
                      className="h-full bg-[#ffc800] transition-[width] duration-200 ease-linear"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}

                <div 
                  className="px-4 py-3 flex items-center gap-4"
                  onClick={() => currentTrack && setIsExpanded(true)}
                >
                  {currentTrack ? (
                    /* Playing - show track info */
                    <>
                      <div className="w-12 h-12 rounded-xl bg-neutral-900 overflow-hidden flex-shrink-0 shadow-lg">
                        {currentTrack.albumImage ? (
                          <img 
                            src={currentTrack.albumImage} 
                            alt={currentTrack.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-5 h-5 text-[#ffc800]/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[15px] font-medium truncate leading-tight">
                          {currentTrack.title}
                        </p>
                        <p className="text-white/50 text-[13px] truncate mt-0.5">
                          {currentTrack.artistName || 'Artista desconocido'}
                        </p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                        className="w-11 h-11 flex items-center justify-center text-white active:scale-90 transition-transform"
                      >
                        {isPlaying ? (
                          <Pause className="w-7 h-7" fill="currentColor" />
                        ) : (
                          <Play className="w-7 h-7 ml-0.5" fill="currentColor" />
                        )}
                      </button>
                    </>
                  ) : playlists.length > 0 ? (
                    /* No track - show playlist selector */
                    <>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffc800]/20 to-[#ffc800]/5 flex items-center justify-center flex-shrink-0">
                        <Music className="w-5 h-5 text-[#ffc800]/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[15px] font-medium">
                          Música
                        </p>
                        <p className="text-white/40 text-[13px]">
                          {playlists.length} playlist{playlists.length !== 1 ? 's' : ''} disponible{playlists.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-9 px-4 bg-[#ffc800] rounded-full text-black text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform">
                            <Play className="w-4 h-4" fill="currentColor" />
                            Play
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          side="top" 
                          className="w-72 max-h-[60vh] overflow-y-auto bg-neutral-950/98 backdrop-blur-2xl border-white/10 rounded-2xl p-2"
                        >
                          <div className="px-3 py-2 mb-1">
                            <p className="text-white/40 text-xs uppercase tracking-wider font-medium">Playlists</p>
                          </div>
                          {playlists.map((playlist) => (
                            <DropdownMenuItem 
                              key={playlist.id} 
                              onClick={() => handlePlaylistSelect(playlist)} 
                              className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-white/10 focus:bg-white/10"
                            >
                              <div className="w-11 h-11 rounded-lg bg-neutral-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {playlist.coverUrl ? (
                                  <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Music className="w-5 h-5 text-[#ffc800]/40" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-[15px] font-medium truncate">{playlist.name}</p>
                                <p className="text-white/40 text-[13px]">{playlist._count?.tracks || 0} canciones</p>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* ==================== DESKTOP PLAYER ==================== */}
          <div className="hidden md:flex h-20 px-4 items-center gap-4">
            {/* Left: Track info */}
            <div className="flex items-center gap-3 w-64 min-w-0">
              {currentTrack ? (
                <>
                  <div className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {currentTrack.albumImage ? (
                      <img src={currentTrack.albumImage} alt={currentTrack.title} className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-6 h-6 text-[#ffc800]/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{currentTrack.title}</p>
                    <p className="text-white/60 text-sm truncate">{currentTrack.artistName || 'Artista desconocido'}</p>
                  </div>
                </>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-10 text-white/70 hover:text-[#ffc800] hover:bg-white/10 border border-white/20">
                      <ListMusic className="w-4 h-4 mr-2" />
                      Selecciona playlist
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" side="top" className="w-64 max-h-64 overflow-y-auto bg-black/95 backdrop-blur-xl border-[#ffc800]/20">
                    {playlists.map((playlist) => (
                      <DropdownMenuItem key={playlist.id} onClick={() => handlePlaylistSelect(playlist)} className="flex items-center gap-3 cursor-pointer hover:bg-[#ffc800]/20">
                        <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center overflow-hidden">
                          {playlist.coverUrl ? <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" /> : <Music className="w-5 h-5 text-[#ffc800]/50" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{playlist.name}</p>
                          <p className="text-white/60 text-sm">{playlist._count?.tracks || 0} canciones</p>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* Center: Controls */}
            <div className="flex-1 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className={cn('w-8 h-8 text-white/60 hover:text-[#ffc800]', isShuffled && 'text-[#ffc800]')} onClick={() => setIsShuffled(!isShuffled)}>
                  <Shuffle className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="w-10 h-10 text-white hover:text-[#ffc800]" onClick={previous} disabled={!currentTrack}>
                  <SkipBack className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className="w-12 h-12 bg-[#ffc800] text-black hover:bg-[#ffc800]/80 rounded-full" onClick={togglePlay} disabled={!currentTrack}>
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="w-10 h-10 text-white hover:text-[#ffc800]" onClick={next} disabled={!currentTrack}>
                  <SkipForward className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="icon" className={cn('w-8 h-8 text-white/60 hover:text-[#ffc800]', repeatMode !== 'none' && 'text-[#ffc800]')} onClick={cycleRepeatMode}>
                  {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
                </Button>
              </div>
              <div className="w-full max-w-md flex items-center gap-2">
                <span className="text-white/60 text-xs w-10 text-right">{formatTime(progress)}</span>
                <Slider value={[progress]} max={trackDuration} step={1} onValueChange={handleSeek} disabled={!currentTrack} className="flex-1 [&_[role=slider]]:bg-[#ffc800] [&_[role=slider]]:border-0 [&_.bg-primary]:bg-[#ffc800]" />
                <span className="text-white/60 text-xs w-10">{formatTime(trackDuration)}</span>
              </div>
            </div>

            {/* Right: Volume & extras */}
            <div className="flex items-center gap-2 w-48 justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-[#ffc800]">
                    <ListMusic className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-black/95 backdrop-blur-xl border-[#ffc800]/20">
                  {playlists.map((playlist) => (
                    <DropdownMenuItem key={playlist.id} onClick={() => handlePlaylistSelect(playlist)} className={cn('flex items-center gap-3 cursor-pointer', currentPlaylist?.id === playlist.id ? 'bg-[#ffc800]/20 text-[#ffc800]' : 'hover:bg-[#ffc800]/20')}>
                      <div className="w-10 h-10 rounded bg-black/30 flex items-center justify-center overflow-hidden">
                        {playlist.coverUrl ? <img src={playlist.coverUrl} alt={playlist.name} className="w-full h-full object-cover" /> : <Music className="w-5 h-5 text-[#ffc800]/50" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{playlist.name}</p>
                        <p className="text-white/60 text-sm">{playlist._count?.tracks || 0} canciones</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-[#ffc800]" onClick={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </Button>
                <Slider value={[volume]} max={1} step={0.01} onValueChange={handleVolumeChange} className="w-20 [&_[role=slider]]:bg-[#ffc800] [&_[role=slider]]:border-0 [&_.bg-primary]:bg-[#ffc800]" />
              </div>
              <Button variant="ghost" size="icon" className="w-8 h-8 text-white/60 hover:text-[#ffc800]" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MusicPlayer;
