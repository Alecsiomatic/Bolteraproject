import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Loader2, MapPin, Building2, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";

interface Venue {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  capacity: number | null;
  description: string | null;
}

const fetchVenue = async (venueId: string): Promise<Venue> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/venues/${venueId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Venue no encontrado");
  return response.json();
};

const updateVenue = async ({ venueId, data }: { venueId: string; data: Partial<Venue> }) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/venues/${venueId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Error al actualizar");
  }
  return response.json();
};

export default function AdminVenueEdit() {
  const { venueId } = useParams<{ venueId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    capacity: "",
    description: "",
  });

  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", venueId],
    queryFn: () => fetchVenue(venueId!),
    enabled: !!venueId,
  });

  useEffect(() => {
    if (venue) {
      setFormData({
        name: venue.name || "",
        slug: venue.slug || "",
        address: venue.address || "",
        city: venue.city || "",
        state: venue.state || "",
        country: venue.country || "",
        postalCode: venue.postalCode || "",
        capacity: venue.capacity?.toString() || "",
        description: venue.description || "",
      });
    }
  }, [venue]);

  const mutation = useMutation({
    mutationFn: updateVenue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      queryClient.invalidateQueries({ queryKey: ["venue", venueId] });
      toast.success("Venue actualizado correctamente");
      navigate("/admin/venues");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    mutation.mutate({
      venueId: venueId!,
      data: {
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        address: formData.address.trim() || null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        country: formData.country.trim() || null,
        postalCode: formData.postalCode.trim() || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        description: formData.description.trim() || null,
      },
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-white">
        <p className="mb-4 text-lg">Venue no encontrado</p>
        <Link to="/admin/venues">
          <Button variant="outline">Volver a venues</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="flex items-center justify-between rounded-[32px] border border-white/10 bg-white/5 px-8 py-8 backdrop-blur-2xl">
        <div className="flex items-center gap-4">
          <Link to="/admin/venues">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-300">Editar Venue</p>
            <h1 className="mt-2 text-3xl font-semibold">{venue.name}</h1>
          </div>
        </div>
        <Link to={`/canvas?venueId=${venue.id}`}>
          <Button variant="outline" className="border-white/20">
            <LayoutGrid className="mr-2 h-4 w-4" />
            Editar Layout
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Información Básica
              </CardTitle>
              <CardDescription>Datos principales del venue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Estadio Azteca"
                  className="border-white/20 bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => handleChange("slug", e.target.value)}
                  placeholder="estadio-azteca"
                  className="border-white/20 bg-white/5"
                />
                <p className="text-xs text-slate-400">Se genera automáticamente si lo dejas vacío</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => handleChange("capacity", e.target.value)}
                  placeholder="50000"
                  className="border-white/20 bg-white/5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Descripción del venue..."
                  rows={4}
                  className="border-white/20 bg-white/5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Ubicación
              </CardTitle>
              <CardDescription>Dirección del venue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                  placeholder="Calz. de Tlalpan 3465"
                  className="border-white/20 bg-white/5"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    placeholder="Ciudad de México"
                    className="border-white/20 bg-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    placeholder="CDMX"
                    className="border-white/20 bg-white/5"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    placeholder="México"
                    className="border-white/20 bg-white/5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Código Postal</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => handleChange("postalCode", e.target.value)}
                    placeholder="04600"
                    className="border-white/20 bg-white/5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <Link to="/admin/venues">
            <Button type="button" variant="outline" className="border-white/20">
              Cancelar
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={mutation.isPending}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Guardar Cambios
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
