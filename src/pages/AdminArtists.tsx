import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Music,
  Star,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Loader2,
  Upload,
  X,
  ExternalLink,
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
  twitterUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  genres?: string[];
  origin?: string;
  formedYear?: number;
  achievements?: string[];
  isActive: boolean;
  isFeatured: boolean;
  _count?: { events: number; playlists: number };
}

const emptyArtist: Partial<Artist> = {
  name: "",
  slug: "",
  bio: "",
  shortBio: "",
  profileImage: "",
  coverImage: "",
  genres: [],
  origin: "",
  website: "",
  spotifyUrl: "",
  instagramUrl: "",
  facebookUrl: "",
  youtubeUrl: "",
  isActive: true,
  isFeatured: false,
};

export default function AdminArtists() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArtist, setEditingArtist] = useState<Partial<Artist> | null>(null);
  const [genreInput, setGenreInput] = useState("");
  const [uploading, setUploading] = useState(false);

  // Fetch artists
  const { data, isLoading } = useQuery({
    queryKey: ["admin-artists", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE_URL}/api/artists?${params}`);
      if (!res.ok) throw new Error("Error fetching artists");
      return res.json();
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (artist: Partial<Artist>) => {
      const url = artist.id
        ? `${API_BASE_URL}/api/artists/${artist.id}`
        : `${API_BASE_URL}/api/artists`;
      const method = artist.id ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artist),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Error saving artist");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-artists"] });
      setIsDialogOpen(false);
      setEditingArtist(null);
      toast({ title: "Éxito", description: "Artista guardado correctamente" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/api/artists/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error deleting artist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-artists"] });
      toast({ title: "Eliminado", description: "Artista eliminado correctamente" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar" });
    },
  });

  const handleOpenCreate = () => {
    setEditingArtist({ ...emptyArtist });
    setGenreInput("");
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (artist: Artist) => {
    setEditingArtist({ ...artist });
    setGenreInput("");
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingArtist?.name) {
      toast({ variant: "destructive", title: "Error", description: "El nombre es requerido" });
      return;
    }
    saveMutation.mutate(editingArtist);
  };

  const handleImageUpload = async (file: File, field: "profileImage" | "coverImage") => {
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
      
      setEditingArtist(prev => prev ? { ...prev, [field]: data.url } : null);
      toast({ title: "Imagen subida" });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo subir la imagen" });
    } finally {
      setUploading(false);
    }
  };

  const addGenre = () => {
    if (genreInput.trim() && editingArtist) {
      const genres = editingArtist.genres || [];
      if (!genres.includes(genreInput.trim())) {
        setEditingArtist({ ...editingArtist, genres: [...genres, genreInput.trim()] });
      }
      setGenreInput("");
    }
  };

  const removeGenre = (genre: string) => {
    if (editingArtist) {
      setEditingArtist({
        ...editingArtist,
        genres: (editingArtist.genres || []).filter(g => g !== genre),
      });
    }
  };

  const artists: Artist[] = data?.artists || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Music className="h-8 w-8 text-gold-400" />
            Artistas
          </h1>
          <p className="text-white/60 mt-1">Gestiona los artistas de la plataforma</p>
        </div>
        <Button onClick={handleOpenCreate} className="bg-gold-500 text-black hover:bg-gold-400">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Artista
        </Button>
      </div>

      {/* Search */}
      <Card className="border-gold-500/20 bg-black/40 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Buscar artistas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 border-gold-500/20 bg-black/40 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Artists Table */}
      <Card className="border-gold-500/20 bg-black/40 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Lista de Artistas</CardTitle>
          <CardDescription>{artists.length} artistas registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
            </div>
          ) : artists.length === 0 ? (
            <div className="text-center py-10 text-white/60">
              No hay artistas registrados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gold-500/20">
                  <TableHead className="text-white/60">Artista</TableHead>
                  <TableHead className="text-white/60">Géneros</TableHead>
                  <TableHead className="text-white/60">Origen</TableHead>
                  <TableHead className="text-white/60 text-center">Eventos</TableHead>
                  <TableHead className="text-white/60 text-center">Estado</TableHead>
                  <TableHead className="text-white/60 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {artists.map((artist) => (
                  <TableRow key={artist.id} className="border-gold-500/10">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {artist.profileImage ? (
                          <img
                            src={artist.profileImage}
                            alt={artist.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gold-500/20 flex items-center justify-center">
                            <Music className="h-5 w-5 text-gold-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">{artist.name}</p>
                          <p className="text-sm text-white/50">/{artist.slug}</p>
                        </div>
                        {artist.isFeatured && (
                          <Star className="h-4 w-4 text-gold-400 fill-gold-400" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(artist.genres || []).slice(0, 2).map((genre) => (
                          <Badge key={genre} variant="outline" className="text-xs border-gold-500/30 text-gold-400">
                            {genre}
                          </Badge>
                        ))}
                        {(artist.genres || []).length > 2 && (
                          <Badge variant="outline" className="text-xs border-gold-500/30 text-gold-400">
                            +{(artist.genres || []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70">{artist.origin || "-"}</TableCell>
                    <TableCell className="text-center text-white/70">
                      {artist._count?.events || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={artist.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                        {artist.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-white/60 hover:text-white">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-black/90 border-gold-500/20">
                          <DropdownMenuItem onClick={() => handleOpenEdit(artist)} className="text-white hover:bg-gold-500/20">
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => window.open(`/artista/${artist.slug}`, "_blank")}
                            className="text-white hover:bg-gold-500/20"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Ver Landing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(artist.id)}
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

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] border-gold-500/20">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              {editingArtist?.id ? "Editar Artista" : "Nuevo Artista"}
            </DialogTitle>
            <DialogDescription>
              {editingArtist?.id ? "Modifica la información del artista" : "Completa la información del nuevo artista"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Nombre *</Label>
                <Input
                  value={editingArtist?.name || ""}
                  onChange={(e) => setEditingArtist(prev => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="Nombre del artista"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Slug (URL)</Label>
                <Input
                  value={editingArtist?.slug || ""}
                  onChange={(e) => setEditingArtist(prev => prev ? { ...prev, slug: e.target.value } : null)}
                  placeholder="nombre-del-artista"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
            </div>

            {/* Images */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Imagen de Perfil</Label>
                <div className="flex items-center gap-3">
                  {editingArtist?.profileImage ? (
                    <img src={editingArtist.profileImage} alt="" className="h-16 w-16 rounded-full object-cover" />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gold-500/20 flex items-center justify-center">
                      <Music className="h-6 w-6 text-gold-400" />
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
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "profileImage")}
                    />
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Imagen de Portada</Label>
                <div className="flex items-center gap-3">
                  {editingArtist?.coverImage ? (
                    <img src={editingArtist.coverImage} alt="" className="h-16 w-24 rounded object-cover" />
                  ) : (
                    <div className="h-16 w-24 rounded bg-gold-500/20 flex items-center justify-center">
                      <Music className="h-6 w-6 text-gold-400" />
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
                      onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "coverImage")}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label className="text-white/80">Biografía corta (para cards)</Label>
              <Input
                value={editingArtist?.shortBio || ""}
                onChange={(e) => setEditingArtist(prev => prev ? { ...prev, shortBio: e.target.value } : null)}
                placeholder="Breve descripción del artista"
                className="border-gold-500/20 bg-black/40 text-white"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-white/80">Biografía completa</Label>
              <Textarea
                value={editingArtist?.bio || ""}
                onChange={(e) => setEditingArtist(prev => prev ? { ...prev, bio: e.target.value } : null)}
                placeholder="Historia, trayectoria, logros..."
                className="min-h-[120px] border-gold-500/20 bg-black/40 text-white"
              />
            </div>

            {/* Genres */}
            <div className="space-y-2">
              <Label className="text-white/80">Géneros musicales</Label>
              <div className="flex gap-2">
                <Input
                  value={genreInput}
                  onChange={(e) => setGenreInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGenre())}
                  placeholder="Agregar género"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
                <Button onClick={addGenre} variant="outline" className="border-gold-500/20">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(editingArtist?.genres || []).map((genre) => (
                  <Badge key={genre} className="bg-gold-500/20 text-gold-400 gap-1">
                    {genre}
                    <button onClick={() => removeGenre(genre)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Origin & Year */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-white/80">Origen</Label>
                <Input
                  value={editingArtist?.origin || ""}
                  onChange={(e) => setEditingArtist(prev => prev ? { ...prev, origin: e.target.value } : null)}
                  placeholder="Ciudad, País"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Año de inicio</Label>
                <Input
                  type="number"
                  value={editingArtist?.formedYear || ""}
                  onChange={(e) => setEditingArtist(prev => prev ? { ...prev, formedYear: parseInt(e.target.value) || undefined } : null)}
                  placeholder="2010"
                  className="border-gold-500/20 bg-black/40 text-white"
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <Label className="text-white/80">Redes sociales</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-white/40" />
                  <Input
                    value={editingArtist?.website || ""}
                    onChange={(e) => setEditingArtist(prev => prev ? { ...prev, website: e.target.value } : null)}
                    placeholder="Sitio web"
                    className="border-gold-500/20 bg-black/40 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 text-green-500">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                  </div>
                  <Input
                    value={editingArtist?.spotifyUrl || ""}
                    onChange={(e) => setEditingArtist(prev => prev ? { ...prev, spotifyUrl: e.target.value } : null)}
                    placeholder="Spotify URL"
                    className="border-gold-500/20 bg-black/40 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-pink-500" />
                  <Input
                    value={editingArtist?.instagramUrl || ""}
                    onChange={(e) => setEditingArtist(prev => prev ? { ...prev, instagramUrl: e.target.value } : null)}
                    placeholder="Instagram URL"
                    className="border-gold-500/20 bg-black/40 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-500" />
                  <Input
                    value={editingArtist?.facebookUrl || ""}
                    onChange={(e) => setEditingArtist(prev => prev ? { ...prev, facebookUrl: e.target.value } : null)}
                    placeholder="Facebook URL"
                    className="border-gold-500/20 bg-black/40 text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Youtube className="h-4 w-4 text-red-500" />
                  <Input
                    value={editingArtist?.youtubeUrl || ""}
                    onChange={(e) => setEditingArtist(prev => prev ? { ...prev, youtubeUrl: e.target.value } : null)}
                    placeholder="YouTube URL"
                    className="border-gold-500/20 bg-black/40 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Switches */}
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingArtist?.isActive ?? true}
                  onCheckedChange={(checked) => setEditingArtist(prev => prev ? { ...prev, isActive: checked } : null)}
                />
                <Label className="text-white/80">Activo</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={editingArtist?.isFeatured ?? false}
                  onCheckedChange={(checked) => setEditingArtist(prev => prev ? { ...prev, isFeatured: checked } : null)}
                />
                <Label className="text-white/80">Destacado</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gold-500/20">
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="bg-gold-500 text-black hover:bg-gold-400"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingArtist?.id ? "Guardar cambios" : "Crear artista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
