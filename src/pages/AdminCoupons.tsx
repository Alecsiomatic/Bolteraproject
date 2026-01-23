import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Ticket,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  Percent,
  DollarSign,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minPurchase: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number;
  eventId: string | null;
  eventTitle: string | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

interface Event {
  id: string;
  title: string;
}

const initialForm = {
  code: "",
  name: "",
  description: "",
  discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
  discountValue: 10,
  minPurchase: null as number | null,
  maxDiscount: null as number | null,
  usageLimit: null as number | null,
  perUserLimit: 1,
  eventId: null as string | null,
  startsAt: "",
  expiresAt: "",
  isActive: true,
};

export default function AdminCoupons() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<string>("all");
  
  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  
  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCoupons();
    fetchEvents();
  }, [filterActive]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/coupons?limit=100`;
      if (filterActive !== "all") {
        url += `&isActive=${filterActive === "active"}`;
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Error al cargar cupones");
      
      const data = await response.json();
      setCoupons(data.coupons || []);
    } catch (err) {
      toast.error("Error al cargar cupones");
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/events?status=PUBLISHED&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const handleCreate = () => {
    setEditingCoupon(null);
    setForm({
      ...initialForm,
      code: generateCode(),
    });
    setShowDialog(true);
  };

  const handleEdit = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code,
      name: coupon.name,
      description: coupon.description || "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase,
      maxDiscount: coupon.maxDiscount,
      usageLimit: coupon.usageLimit,
      perUserLimit: coupon.perUserLimit,
      eventId: coupon.eventId,
      startsAt: coupon.startsAt ? coupon.startsAt.slice(0, 16) : "",
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : "",
      isActive: coupon.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.discountValue) {
      toast.error("Código, nombre y valor de descuento son requeridos");
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        minPurchase: form.minPurchase || undefined,
        maxDiscount: form.maxDiscount || undefined,
        usageLimit: form.usageLimit || undefined,
        eventId: form.eventId || undefined,
        startsAt: form.startsAt || undefined,
        expiresAt: form.expiresAt || undefined,
      };
      
      const url = editingCoupon
        ? `${API_BASE_URL}/api/coupons/${editingCoupon.id}`
        : `${API_BASE_URL}/api/coupons`;
      
      const response = await fetch(url, {
        method: editingCoupon ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Error al guardar cupón");
      }
      
      toast.success(editingCoupon ? "Cupón actualizado" : "Cupón creado");
      setShowDialog(false);
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar cupón");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    setDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error("Error al eliminar");
      
      toast.success("Cupón eliminado");
      setDeleteTarget(null);
      fetchCoupons();
    } catch (err) {
      toast.error("Error al eliminar cupón");
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/coupons/${coupon.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !coupon.isActive }),
      });
      
      if (!response.ok) throw new Error("Error");
      
      toast.success(coupon.isActive ? "Cupón desactivado" : "Cupón activado");
      fetchCoupons();
    } catch (err) {
      toast.error("Error al cambiar estado");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado");
  };

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const filteredCoupons = coupons.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase())
  );

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discountType === "PERCENTAGE") {
      return `${coupon.discountValue}%`;
    }
    return `$${coupon.discountValue.toFixed(2)}`;
  };

  const isExpired = (coupon: Coupon) => {
    if (!coupon.expiresAt) return false;
    return new Date(coupon.expiresAt) < new Date();
  };

  const getStatus = (coupon: Coupon) => {
    if (!coupon.isActive) return { label: "Inactivo", variant: "secondary" as const };
    if (isExpired(coupon)) return { label: "Expirado", variant: "destructive" as const };
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return { label: "Agotado", variant: "destructive" as const };
    }
    return { label: "Activo", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cupones de Descuento</h1>
          <p className="text-slate-400">Gestiona códigos promocionales para tus eventos</p>
        </div>
        <Button onClick={handleCreate} className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Cupón
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 border-white/20 bg-white/5"
              />
            </div>
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-[180px] border-white/20 bg-white/5">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="inactive">Inactivos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card className="border-white/10 bg-white/5">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
              <p className="mt-2 text-slate-400">Cargando cupones...</p>
            </div>
          ) : filteredCoupons.length === 0 ? (
            <div className="p-8 text-center">
              <Ticket className="h-12 w-12 text-slate-500 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-white">No hay cupones</h3>
              <p className="mt-2 text-slate-400">
                {search ? "No se encontraron cupones con ese criterio" : "Crea tu primer cupón de descuento"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-slate-400">Código</TableHead>
                    <TableHead className="text-slate-400">Nombre</TableHead>
                    <TableHead className="text-slate-400">Descuento</TableHead>
                    <TableHead className="text-slate-400">Uso</TableHead>
                    <TableHead className="text-slate-400">Evento</TableHead>
                    <TableHead className="text-slate-400">Expira</TableHead>
                    <TableHead className="text-slate-400">Estado</TableHead>
                    <TableHead className="text-slate-400 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoupons.map((coupon) => {
                    const status = getStatus(coupon);
                    return (
                      <TableRow key={coupon.id} className="border-white/10">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-bold text-cyan-400">{coupon.code}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(coupon.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-white">{coupon.name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {coupon.discountType === "PERCENTAGE" ? (
                              <Percent className="h-4 w-4 text-amber-400" />
                            ) : (
                              <DollarSign className="h-4 w-4 text-emerald-400" />
                            )}
                            <span className="font-semibold text-white">
                              {formatDiscount(coupon)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-slate-300">
                            {coupon.usedCount}
                            {coupon.usageLimit && ` / ${coupon.usageLimit}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          {coupon.eventTitle ? (
                            <span className="text-slate-300">{coupon.eventTitle}</span>
                          ) : (
                            <span className="text-slate-500">Todos</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {coupon.expiresAt ? (
                            <span className={isExpired(coupon) ? "text-red-400" : "text-slate-300"}>
                              {format(new Date(coupon.expiresAt), "dd/MM/yyyy", { locale: es })}
                            </span>
                          ) : (
                            <span className="text-slate-500">Sin límite</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Switch
                              checked={coupon.isActive}
                              onCheckedChange={() => toggleActive(coupon)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(coupon)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(coupon)}
                            >
                              <Trash2 className="h-4 w-4 text-red-400" />
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
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Editar Cupón" : "Nuevo Cupón"}
            </DialogTitle>
            <DialogDescription>
              {editingCoupon
                ? "Modifica los detalles del cupón"
                : "Crea un código promocional para tus clientes"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="DESCUENTO20"
                    className="font-mono uppercase"
                    disabled={!!editingCoupon}
                  />
                  {!editingCoupon && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setForm({ ...form, code: generateCode() })}
                    >
                      Generar
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Descuento de Verano"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descripción del cupón (opcional)"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Descuento</Label>
                <Select
                  value={form.discountType}
                  onValueChange={(v) => setForm({ ...form, discountType: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                    <SelectItem value="FIXED">Monto Fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor del Descuento *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {form.discountType === "PERCENTAGE" ? "%" : "$"}
                  </span>
                  <Input
                    type="number"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: parseFloat(e.target.value) || 0 })}
                    className="pl-8"
                    min={0}
                    max={form.discountType === "PERCENTAGE" ? 100 : undefined}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Compra Mínima</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    type="number"
                    value={form.minPurchase || ""}
                    onChange={(e) => setForm({ ...form, minPurchase: e.target.value ? parseFloat(e.target.value) : null })}
                    className="pl-8"
                    placeholder="Sin mínimo"
                    min={0}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descuento Máximo</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <Input
                    type="number"
                    value={form.maxDiscount || ""}
                    onChange={(e) => setForm({ ...form, maxDiscount: e.target.value ? parseFloat(e.target.value) : null })}
                    className="pl-8"
                    placeholder="Sin límite"
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Límite de Uso Total</Label>
                <Input
                  type="number"
                  value={form.usageLimit || ""}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Ilimitado"
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>Límite por Usuario</Label>
                <Input
                  type="number"
                  value={form.perUserLimit}
                  onChange={(e) => setForm({ ...form, perUserLimit: parseInt(e.target.value) || 1 })}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Restringir a Evento</Label>
              <Select
                value={form.eventId || "all"}
                onValueChange={(v) => setForm({ ...form, eventId: v === "all" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los eventos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los eventos</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Inicio</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Expiración</Label>
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
              <Label htmlFor="isActive">Cupón activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-br from-cyan-500/80 via-cyan-400/70 to-cyan-500/80 text-white border border-cyan-400/30 shadow-[0_8px_32px_rgba(6,182,212,0.3),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:shadow-[0_12px_40px_rgba(6,182,212,0.4)] backdrop-blur-xl">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : editingCoupon ? (
                "Guardar Cambios"
              ) : (
                "Crear Cupón"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cupón?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el cupón <strong>{deleteTarget?.code}</strong>.
              {deleteTarget?.usedCount && deleteTarget.usedCount > 0 && (
                <span className="block mt-2 text-amber-400">
                  Este cupón ya ha sido usado {deleteTarget.usedCount} veces.
                  Se desactivará en lugar de eliminarse.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
