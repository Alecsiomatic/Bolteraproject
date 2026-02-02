import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMusicStore } from "@/stores/musicStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ListMusic,
  Music2,
  Loader2,
  Upload,
  Play,
  Pause,
  GripVertical,
  Clock,
  Disc3,
  Image,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";

interface Track {
  id: string;
  playlistId: string;
  title: string;
  artistName?: string;
  albumName?: string;
  albumImage?: string;
  duration?: number;
  audioUrl: string;
  trackNumber: number;
  isActive: boolean;
}

interface Playlist {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  artistId?: string;
  artist?: { id: string; name: string; profileImage?: string };
  isPublic: boolean;
  isActive: boolean;
  tracks?: Track[];
  _count?: { tracks: number };
}

interface Artist {
  id: string;
  name: string;
  profileImage?: string;
}

const emptyPlaylist: Partial<Playlist> = {
  name: "",
  slug: "",
  description: "",
  coverImage: "",
  artistId: undefined,
  isPublic: true,
  isActive: true,
};

const emptyTrack: Partial<Track> = {
  title: "",
  artistName: "",
  albumName: "",
  albumImage: "",
  audioUrl: "",
};

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AdminPlaylists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTrackDialogOpen, setIsTrackDialogOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Partial<Playlist> | null>(null);
  const [editingTrack, setEditingTrack] = useState<Partial<Track> | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Global music player
  const { currentTrack, isPlaying, setTrack, togglePlay } = useMusicStore();

  // Fetch playlists
  const { data, isLoading } = useQuery({
    queryKey: ["admin-playlists", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE_URL}/api/playlists?${params}`);
      if (!res.ok) throw new Error("Error fetching playlists");
      return res.json();
    },
  });

  // Fetch artists for dropdown
  const { data: artistsData } = useQuery({
    queryKey: ["admin-artists-list"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/artists?active=true`);
      if (!res.ok) throw new Error("Error fetching artists");
      return res.json();
    },
  });

  // Fetch single playlist with tracks
  const { data: playlistDetail, refetch: refetchPlaylist } = useQuery({
    queryKey: ["playlist-detail", selectedPlaylist?.id],
    queryFn: async () => {
      if (!selectedPlaylist?.id) return null;
      const res = await fetch(`${API_BASE_URL}/api/playlists/${selectedPlaylist.id}`);
      if (!res.ok) throw new Error("Error fetching playlist");
      return res.json();
    },
    enabled: !!selectedPlaylist?.id,
  });

  // Playlist mutations
  const savePlaylistMutation = useMutation({
    mutationFn: async (playlist: Partial<Playlist>) => {
      const url = playlist.id
        ? `${API_BASE_URL}/api/playlists/${playlist.id}`
        : `${API_BASE_URL}/api/playlists`;
      const method = playlist.id ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(playlist),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error saving playlist");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-playlists"] });
      setIsDialogOpen(false);
      setEditingPlaylist(null);
      toast({ title: "Éxito", description: "Playlist guardada correctamente" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error deleting playlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-playlists"] });
      setSelectedPlaylist(null);
      toast({ title: "Eliminado", description: "Playlist eliminada correctamente" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar" });
    },
  });

  // Track mutations
  const saveTrackMutation = useMutation({
    mutationFn: async (track: Partial<Track>) => {
      if (!selectedPlaylist?.id) throw new Error("No playlist selected");
      
      const url = track.id
        ? `${API_BASE_URL}/api/playlists/${selectedPlaylist.id}/tracks/${track.id}`
        : `${API_BASE_URL}/api/playlists/${selectedPlaylist.id}/tracks`;
      const method = track.id ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(track),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error saving track");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchPlaylist();
      setIsTrackDialogOpen(false);
      setEditingTrack(null);
      toast({ title: "Éxito", description: "Track guardado correctamente" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const deleteTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      if (!selectedPlaylist?.id) throw new Error("No playlist selected");
      const res = await fetch(`${API_BASE_URL}/api/playlists/${selectedPlaylist.id}/tracks/${trackId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error deleting track");
      return res.json();
    },
    onSuccess: () => {
      refetchPlaylist();
      toast({ title: "Eliminado", description: "Track eliminado correctamente" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar" });
    },
  });

  const handleOpenCreatePlaylist = () => {
    setEditingPlaylist({ ...emptyPlaylist });
    setIsDialogOpen(true);
  };

  const handleOpenEditPlaylist = (playlist: Playlist) => {
    setEditingPlaylist({ ...playlist });
    setIsDialogOpen(true);
  };

  const handleSavePlaylist = () => {
    if (!editingPlaylist?.name) {
      toast({ variant: "destructive", title: "Error", description: "El nombre es requerido" });
      return;
    }
    savePlaylistMutation.mutate(editingPlaylist);
  };

  const handleOpenCreateTrack = () => {
    setEditingTrack({ ...emptyTrack });
    setIsTrackDialogOpen(true);
  };

  const handleOpenEditTrack = (track: Track) => {
    setEditingTrack({ ...track });
    setIsTrackDialogOpen(true);
  };

  const handleSaveTrack = () => {
    if (!editingTrack?.title || !editingTrack?.audioUrl) {
      toast({ variant: "destructive", title: "Error", description: "Título y archivo de audio son requeridos" });
      return;
    }
    saveTrackMutation.mutate(editingTrack);
  };

  const handleImageUpload = async (file: File, type: "playlist" | "album") => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${API_BASE_URL}/api/upload/misc`, {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      if (type === "playlist") {
        setEditingPlaylist(prev => prev ? { ...prev, coverImage: data.url } : null);
      } else {
        setEditingTrack(prev => prev ? { ...prev, albumImage: data.url } : null);
      }
      toast({ title: "Imagen subida" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo subir la imagen" });
    } finally {
      setUploading(false);
    }
  };

  const handleAudioUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Simulate progress (real progress would need XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const res = await fetch(`${API_BASE_URL}/api/upload/audio`, {
        method: "POST",
        body: formData,
      });
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      
      // Get audio duration
      const audio = new Audio(data.url);
      audio.addEventListener("loadedmetadata", () => {
        setEditingTrack(prev => prev ? { 
          ...prev, 
          audioUrl: data.url,
          duration: Math.round(audio.duration),
          title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
        } : null);
      });
      
      toast({ title: "Audio subido correctamente" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo subir el audio" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const togglePlayTrack = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      // Build playlist for the music store
      const playlist = playlistDetail ? {
        id: playlistDetail.id,
        name: playlistDetail.name,
        coverImage: playlistDetail.coverImage,
        tracks: playlistDetail.tracks.map((t: Track) => ({
          id: t.id,
          title: t.title,
          artistName: t.artistName || playlistDetail.artist?.name,
          albumName: t.albumName,
          albumImage: t.albumImage || playlistDetail.coverImage,
          duration: t.duration,
          audioUrl: t.audioUrl,
        })),
      } : undefined;
      
      setTrack({
        id: track.id,
        title: track.title,
        artistName: track.artistName || playlistDetail?.artist?.name,
        albumName: track.albumName,
        albumImage: track.albumImage || playlistDetail?.coverImage,
        duration: track.duration,
        audioUrl: track.audioUrl,
      }, playlist);
    }
  };

  const playlists: Playlist[] = data?.playlists || [];
  const artists: Artist[] = artistsData?.artists || [];
  const tracks: Track[] = playlistDetail?.tracks || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <ListMusic className="h-8 w-8 text-gold-400" />
            Playlists
          </h1>
          <p className="text-white/60 mt-1">Gestiona las playlists y música de la plataforma</p>
        </div>
        <Button onClick={handleOpenCreatePlaylist} className="bg-gold-500 text-black hover:bg-gold-400">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Playlist
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,1.5fr]">
        {/* Playlists List */}
        <div className="space-y-4">
          {/* Search */}
          <Card className="border-gold-500/20 bg-black/40 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  placeholder="Buscar playlists..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 border-gold-500/20 bg-black/40 text-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Playlists */}
          <Card className="border-gold-500/20 bg-black/40 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Playlists</CardTitle>
              <CardDescription>{playlists.length} playlists</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-10 text-white/60">
                  No hay playlists
                </div>
              ) : (
                playlists.map((playlist) => (
                  <div
                    key={playlist.id}
                    onClick={() => setSelectedPlaylist(playlist)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      selectedPlaylist?.id === playlist.id
                        ? "bg-gold-500/20 border border-gold-500/40"
                        : "hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {playlist.coverImage ? (
                      <img src={playlist.coverImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-gold-500/20 flex items-center justify-center">
                        <ListMusic className="h-6 w-6 text-gold-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{playlist.name}</p>
                      <p className="text-sm text-white/50">
                        {playlist._count?.tracks || 0} tracks
                        {playlist.artist && ` • ${playlist.artist.name}`}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="text-white/40 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-black/90 border-gold-500/20">
                        <DropdownMenuItem onClick={() => handleOpenEditPlaylist(playlist)} className="text-white hover:bg-gold-500/20">
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deletePlaylistMutation.mutate(playlist.id)}
                          className="text-red-400 hover:bg-red-500/20"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tracks Panel */}
        <Card className="border-gold-500/20 bg-black/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white">
                {selectedPlaylist ? selectedPlaylist.name : "Selecciona una playlist"}
              </CardTitle>
              <CardDescription>
                {selectedPlaylist ? `${tracks.length} tracks` : "Elige una playlist para ver sus tracks"}
              </CardDescription>
            </div>
            {selectedPlaylist && (
              <Button onClick={handleOpenCreateTrack} className="bg-gold-500 text-black hover:bg-gold-400">
                <Plus className="mr-2 h-4 w-4" />
                Agregar Track
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedPlaylist ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <Music2 className="h-16 w-16 mb-4" />
                <p>Selecciona una playlist</p>
              </div>
            ) : tracks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/40">
                <Music2 className="h-16 w-16 mb-4" />
                <p>No hay tracks en esta playlist</p>
                <Button onClick={handleOpenCreateTrack} variant="outline" className="mt-4 border-gold-500/20">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar primer track
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-gold-500/20">
                    <TableHead className="w-10 text-white/60">#</TableHead>
                    <TableHead className="text-white/60">Título</TableHead>
                    <TableHead className="text-white/60">Álbum</TableHead>
                    <TableHead className="text-white/60 text-center">
                      <Clock className="h-4 w-4 mx-auto" />
                    </TableHead>
                    <TableHead className="text-white/60 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tracks.map((track, index) => (
                    <TableRow key={track.id} className="border-gold-500/10 group">
                      <TableCell className="text-white/50">
                        <button
                          onClick={() => togglePlayTrack(track)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gold-500/20 transition-colors"
                        >
                          {currentTrack?.id === track.id && isPlaying ? (
                            <Pause className="h-4 w-4 text-gold-400" />
                          ) : currentTrack?.id === track.id ? (
                            <Play className="h-4 w-4 text-gold-400" />
                          ) : (
                            <>
                              <span className="group-hover:hidden">{index + 1}</span>
                              <Play className="h-4 w-4 text-gold-400 hidden group-hover:block" />
                            </>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {track.albumImage ? (
                            <img src={track.albumImage} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-gold-500/20 flex items-center justify-center">
                              <Disc3 className="h-5 w-5 text-gold-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-white">{track.title}</p>
                            <p className="text-sm text-white/50">{track.artistName || "Artista desconocido"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-white/70">{track.albumName || "-"}</TableCell>
                      <TableCell className="text-center text-white/50">
                        {track.duration ? formatDuration(track.duration) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white/40 hover:text-white">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-black/90 border-gold-500/20">
                            <DropdownMenuItem onClick={() => handleOpenEditTrack(track)} className="text-white hover:bg-gold-500/20">
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteTrackMutation.mutate(track.id)}
                              className="text-red-400 hover:bg-red-500/20"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Playlist Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-gold-500/20">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              {editingPlaylist?.id ? "Editar Playlist" : "Nueva Playlist"}
            </DialogTitle>
            <DialogDescription>
              {editingPlaylist?.id ? "Modifica la información" : "Crea una nueva playlist"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-white/80">Nombre *</Label>
              <Input
                value={editingPlaylist?.name || ""}
                onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, name: e.target.value } : null)}
                placeholder="Nombre de la playlist"
                className="border-gold-500/20 bg-black/40 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Descripción</Label>
              <Textarea
                value={editingPlaylist?.description || ""}
                onChange={(e) => setEditingPlaylist(prev => prev ? { ...prev, description: e.target.value } : null)}
                placeholder="Descripción de la playlist"
                className="border-gold-500/20 bg-black/40 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Artista (opcional)</Label>
              <Select
                value={editingPlaylist?.artistId || "none"}
                onValueChange={(value) => setEditingPlaylist(prev => prev ? { ...prev, artistId: value === "none" ? undefined : value } : null)}
              >
                <SelectTrigger className="border-gold-500/20 bg-black/40 text-white">
                  <SelectValue placeholder="Seleccionar artista" />
                </SelectTrigger>
                <SelectContent className="bg-black/90 border-gold-500/20">
                  <SelectItem value="none">Sin artista</SelectItem>
                  {artists.map((artist) => (
                    <SelectItem key={artist.id} value={artist.id}>
                      {artist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Imagen de portada</Label>
              <div className="flex items-center gap-3">
                {editingPlaylist?.coverImage ? (
                  <img src={editingPlaylist.coverImage} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-gold-500/20 flex items-center justify-center">
                    <ListMusic className="h-6 w-6 text-gold-400" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" className="border-gold-500/20" asChild disabled={uploading}>
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      Subir
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "playlist")}
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingPlaylist?.isPublic ?? true}
                  onCheckedChange={(checked) => setEditingPlaylist(prev => prev ? { ...prev, isPublic: checked } : null)}
                />
                <Label className="text-white/80">Pública</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingPlaylist?.isActive ?? true}
                  onCheckedChange={(checked) => setEditingPlaylist(prev => prev ? { ...prev, isActive: checked } : null)}
                />
                <Label className="text-white/80">Activa</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gold-500/20">
              Cancelar
            </Button>
            <Button
              onClick={handleSavePlaylist}
              disabled={savePlaylistMutation.isPending}
              className="bg-gold-500 text-black hover:bg-gold-400"
            >
              {savePlaylistMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Track Dialog */}
      <Dialog open={isTrackDialogOpen} onOpenChange={setIsTrackDialogOpen}>
        <DialogContent className="max-w-lg bg-[#0a0a0a] border-gold-500/20">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              {editingTrack?.id ? "Editar Track" : "Nuevo Track"}
            </DialogTitle>
            <DialogDescription>
              {editingTrack?.id ? "Modifica la información del track" : "Sube un nuevo track"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Audio Upload */}
            <div className="space-y-2">
              <Label className="text-white/80">Archivo de audio *</Label>
              {editingTrack?.audioUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
                  <Music2 className="h-8 w-8 text-gold-400" />
                  <div className="flex-1">
                    <p className="text-white text-sm">Audio cargado</p>
                    <p className="text-white/50 text-xs truncate">{editingTrack.audioUrl}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingTrack(prev => prev ? { ...prev, audioUrl: "" } : null)}
                    className="text-white/60"
                  >
                    Cambiar
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <div className="border-2 border-dashed border-gold-500/30 rounded-xl p-6 text-center hover:bg-gold-500/5 transition-colors">
                    {uploading ? (
                      <div className="space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-gold-400 mx-auto" />
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="text-white/60 text-sm">Subiendo... {uploadProgress}%</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-gold-400 mx-auto mb-2" />
                        <p className="text-white/80">Click para subir MP3</p>
                        <p className="text-white/40 text-sm">Máximo 50MB</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Título *</Label>
              <Input
                value={editingTrack?.title || ""}
                onChange={(e) => setEditingTrack(prev => prev ? { ...prev, title: e.target.value } : null)}
                placeholder="Nombre de la canción"
                className="border-gold-500/20 bg-black/40 text-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Artista</Label>
                <Input
                  value={editingTrack?.artistName || ""}
                  onChange={(e) => setEditingTrack(prev => prev ? { ...prev, artistName: e.target.value } : null)}
                  placeholder="Nombre del artista"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Álbum</Label>
                <Input
                  value={editingTrack?.albumName || ""}
                  onChange={(e) => setEditingTrack(prev => prev ? { ...prev, albumName: e.target.value } : null)}
                  placeholder="Nombre del álbum"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Imagen del álbum</Label>
              <div className="flex items-center gap-3">
                {editingTrack?.albumImage ? (
                  <img src={editingTrack.albumImage} alt="" className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded bg-gold-500/20 flex items-center justify-center">
                    <Image className="h-6 w-6 text-gold-400" />
                  </div>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" className="border-gold-500/20" asChild disabled={uploading}>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Subir
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "album")}
                  />
                </label>
              </div>
            </div>

            {editingTrack?.duration && (
              <div className="flex items-center gap-2 text-white/60">
                <Clock className="h-4 w-4" />
                <span>Duración: {formatDuration(editingTrack.duration)}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTrackDialogOpen(false)} className="border-gold-500/20">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTrack}
              disabled={saveTrackMutation.isPending || !editingTrack?.audioUrl}
              className="bg-gold-500 text-black hover:bg-gold-400"
            >
              {saveTrackMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
