import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, Category, CreateCategoryPayload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GripVertical,
  Music,
  Theater,
  Trophy,
  Mic2,
  PartyPopper,
  Film,
  Palette,
} from "lucide-react";

const ICON_OPTIONS = [
  { value: "music", label: "Música", icon: Music },
  { value: "theater", label: "Teatro", icon: Theater },
  { value: "sports", label: "Deportes", icon: Trophy },
  { value: "comedy", label: "Comedia", icon: Mic2 },
  { value: "party", label: "Fiesta", icon: PartyPopper },
  { value: "film", label: "Cine", icon: Film },
  { value: "art", label: "Arte", icon: Palette },
];

const DEFAULT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  coverImage: string | null;
  isActive: boolean;
};

const emptyForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
  icon: "music",
  color: "#3b82f6",
  coverImage: null,
  isActive: true,
};

const AdminCategories = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.listCategories(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateCategoryPayload) => api.createCategory(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoría creada" });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateCategoryPayload> }) =>
      api.updateCategory(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoría actualizada" });
      handleCloseDialog();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoría eliminada" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  const handleOpenNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowDialog(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description || "",
      icon: category.icon || "music",
      color: category.color || "#3b82f6",
      coverImage: category.coverImage,
      isActive: category.isActive,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Nombre y slug son requeridos" });
      return;
    }

    const payload: CreateCategoryPayload = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim() || undefined,
      icon: form.icon || undefined,
      color: form.color || undefined,
      coverImage: form.coverImage || undefined,
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`¿Eliminar la categoría "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find((opt) => opt.value === iconName);
    return found ? found.icon : Music;
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorías</h1>
          <p className="text-slate-400">Gestiona las categorías de eventos</p>
        </div>
        <Button onClick={handleOpenNew} className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
          <Plus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        </div>
      ) : !categories?.length ? (
        <div className="rounded-lg border border-white/10 bg-white/5 p-12 text-center">
          <Palette className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <h3 className="text-lg font-medium text-white">No hay categorías</h3>
          <p className="mt-1 text-slate-400">Crea tu primera categoría para organizar tus eventos</p>
          <Button onClick={handleOpenNew} className="mt-4">
            <Plus className="mr-2 h-4 w-4" />
            Crear categoría
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-400 w-12"></TableHead>
                <TableHead className="text-slate-400">Nombre</TableHead>
                <TableHead className="text-slate-400">Slug</TableHead>
                <TableHead className="text-slate-400 text-center">Eventos</TableHead>
                <TableHead className="text-slate-400 text-center">Estado</TableHead>
                <TableHead className="text-slate-400 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const IconComponent = getIconComponent(category.icon || "music");
                return (
                  <TableRow key={category.id} className="border-white/10">
                    <TableCell>
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: category.color || "#3b82f6" }}
                      >
                        <IconComponent className="h-4 w-4 text-white" />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-white">{category.name}</TableCell>
                    <TableCell className="text-slate-400">{category.slug}</TableCell>
                    <TableCell className="text-center text-slate-400">
                      {category.eventCount ?? 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs ${
                          category.isActive
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {category.isActive ? "Activa" : "Inactiva"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300"
                          onClick={() => handleDelete(category.id, category.name)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog for create/edit */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg border-white/10 bg-slate-900 text-white">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar categoría" : "Nueva categoría"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                    slug: editingId ? prev.slug : generateSlug(e.target.value),
                  }));
                }}
                placeholder="Conciertos"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Slug (URL)</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="conciertos"
                className="mt-1"
              />
              <p className="mt-1 text-xs text-slate-500">
                URL: /category/{form.slug || "slug"}
              </p>
            </div>

            <div>
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Eventos musicales en vivo..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <Label>Icono</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {ICON_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, icon: option.value }))}
                      className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                        form.icon === option.value
                          ? "border-cyan-500 bg-cyan-500/20"
                          : "border-white/10 bg-white/5 hover:border-white/20"
                      }`}
                      title={option.label}
                    >
                      <Icon className="h-5 w-5" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, color }))}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      form.color === color
                        ? "scale-110 border-white"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <ImageUpload
              label="Imagen de portada"
              value={form.coverImage}
              onChange={(url) => setForm((prev) => ({ ...prev, coverImage: url }))}
              folder="categories"
              aspectRatio="banner"
            />

            <div className="flex items-center justify-between">
              <Label>Activa</Label>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : editingId ? (
                "Guardar cambios"
              ) : (
                "Crear categoría"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategories;
