import { useState, useEffect } from "react";
import { AlertTriangle, Bell, Plus, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface Alert {
  id: string;
  venueId: string;
  name: string;
  type: "capacity" | "sales" | "stock" | "schedule";
  condition: string;
  threshold: number | null;
  notifyEmails: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface ValidationResult {
  capacity?: {
    venueId: string;
    capacity: number;
    totalSeats: number;
    availableCapacity: number;
    occupancyPercentage: number;
    isOverCapacity: boolean;
    status: "ok" | "warning" | "error";
  };
  schedule?: {
    venueId: string;
    conflicts: Array<{
      event: string;
      session1: { id: string; title: string; start: string; end: string };
      session2: { id: string; title: string; start: string; end: string };
      overlapMinutes: number;
    }>;
    hasConflicts: boolean;
    totalConflicts: number;
  };
  stock?: {
    venueId: string;
    threshold: number;
    lowStockProducts: Array<{
      id: string;
      name: string;
      type: string;
      price: number;
      stock: number;
      isActive: boolean;
    }>;
    totalLowStock: number;
    criticalStock: number;
  };
}

interface AlertsManagerProps {
  venueId: string;
  apiBaseUrl?: string;
}

const ALERT_TYPES = [
  { value: "capacity", label: "Capacidad", icon: "👥", color: "text-blue-600" },
  { value: "sales", label: "Ventas", icon: "💰", color: "text-green-600" },
  { value: "stock", label: "Inventario", icon: "📦", color: "text-orange-600" },
  { value: "schedule", label: "Horario", icon: "📅", color: "text-purple-600" },
];

export function AlertsManager({ venueId, apiBaseUrl = "http://localhost:4000" }: AlertsManagerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [validation, setValidation] = useState<ValidationResult>({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "capacity" as Alert["type"],
    condition: "",
    threshold: null as number | null,
    notifyEmails: "",
    isActive: true,
  });

  useEffect(() => {
    loadAlerts();
    loadValidation();
  }, [venueId]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/venues/${venueId}/alerts`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast.error("Error al cargar alertas");
    } finally {
      setLoading(false);
    }
  };

  const loadValidation = async () => {
    try {
      const [capacityRes, scheduleRes, stockRes] = await Promise.all([
        fetch(`${apiBaseUrl}/api/venues/${venueId}/validation/capacity`),
        fetch(`${apiBaseUrl}/api/venues/${venueId}/validation/schedule`),
        fetch(`${apiBaseUrl}/api/venues/${venueId}/validation/stock?threshold=10`),
      ]);

      setValidation({
        capacity: await capacityRes.json(),
        schedule: await scheduleRes.json(),
        stock: await stockRes.json(),
      });
    } catch (error) {
      console.error("Error loading validation:", error);
    }
  };

  const handleCreate = () => {
    setEditingAlert(null);
    setFormData({
      name: "",
      type: "capacity",
      condition: "",
      threshold: null,
      notifyEmails: "",
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEdit = (alert: Alert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      type: alert.type,
      condition: alert.condition,
      threshold: alert.threshold,
      notifyEmails: alert.notifyEmails.join(", "),
      isActive: alert.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (!formData.condition.trim()) {
      toast.error("La condición es requerida");
      return;
    }

    const emails = formData.notifyEmails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    if (emails.length === 0) {
      toast.error("Agrega al menos un email");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        condition: formData.condition.trim(),
        threshold: formData.threshold,
        notifyEmails: emails,
        isActive: formData.isActive,
      };

      if (editingAlert) {
        await fetch(`${apiBaseUrl}/api/venues/${venueId}/alerts/${editingAlert.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Alerta actualizada");
      } else {
        await fetch(`${apiBaseUrl}/api/venues/${venueId}/alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Alerta creada");
      }

      setShowDialog(false);
      loadAlerts();
    } catch (error) {
      console.error("Error saving alert:", error);
      toast.error("Error al guardar alerta");
    }
  };

  const handleDelete = async (alertId: string, alertName: string) => {
    if (!confirm(`¿Eliminar alerta "${alertName}"?`)) return;

    try {
      await fetch(`${apiBaseUrl}/api/venues/${venueId}/alerts/${alertId}`, {
        method: "DELETE",
      });
      toast.success("Alerta eliminada");
      loadAlerts();
    } catch (error) {
      console.error("Error deleting alert:", error);
      toast.error("Error al eliminar alerta");
    }
  };

  const getTypeConfig = (type: string) => {
    return ALERT_TYPES.find((t) => t.value === type) || ALERT_TYPES[0];
  };

  const getValidationStatusColor = (status?: string) => {
    switch (status) {
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      default:
        return "text-green-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Validation Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Estado de Validación
          </CardTitle>
          <CardDescription>Monitoreo en tiempo real de límites y conflictos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Capacity */}
            {validation.capacity && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Capacidad</span>
                    <span className={getValidationStatusColor(validation.capacity.status)}>
                      {validation.capacity.status === "error" ? (
                        <XCircle className="h-4 w-4" />
                      ) : validation.capacity.status === "warning" ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">
                    {validation.capacity.occupancyPercentage.toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {validation.capacity.totalSeats} / {validation.capacity.capacity} asientos
                  </div>
                  {validation.capacity.isOverCapacity && (
                    <Badge variant="destructive" className="text-xs">
                      Sobrecapacidad
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Schedule Conflicts */}
            {validation.schedule && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Horarios</span>
                    <span
                      className={
                        validation.schedule.hasConflicts ? "text-red-600" : "text-green-600"
                      }
                    >
                      {validation.schedule.hasConflicts ? (
                        <XCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{validation.schedule.totalConflicts}</div>
                  <div className="text-xs text-muted-foreground">
                    {validation.schedule.hasConflicts ? "Conflictos detectados" : "Sin conflictos"}
                  </div>
                  {validation.schedule.hasConflicts && (
                    <Badge variant="destructive" className="text-xs">
                      Requiere atención
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Low Stock */}
            {validation.stock && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Inventario</span>
                    <span
                      className={
                        validation.stock.criticalStock > 0
                          ? "text-red-600"
                          : validation.stock.totalLowStock > 0
                          ? "text-yellow-600"
                          : "text-green-600"
                      }
                    >
                      {validation.stock.criticalStock > 0 ? (
                        <XCircle className="h-4 w-4" />
                      ) : validation.stock.totalLowStock > 0 ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold">{validation.stock.totalLowStock}</div>
                  <div className="text-xs text-muted-foreground">
                    Productos con stock bajo
                    {validation.stock.criticalStock > 0 &&
                      ` (${validation.stock.criticalStock} agotados)`}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alertas Configuradas
              </CardTitle>
              <CardDescription>Notificaciones automáticas por email</CardDescription>
            </div>
            <Button onClick={handleCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Alerta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay alertas configuradas
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const typeConfig = getTypeConfig(alert.type);
                return (
                  <Card key={alert.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xl">{typeConfig.icon}</span>
                            <h4 className="font-semibold">{alert.name}</h4>
                            <Badge variant={alert.isActive ? "default" : "secondary"}>
                              {alert.isActive ? "Activa" : "Inactiva"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            <span className="font-medium">Condición:</span> {alert.condition}
                            {alert.threshold !== null && ` (umbral: ${alert.threshold})`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Notificar a:</span>{" "}
                            {alert.notifyEmails.join(", ")}
                          </p>
                          {alert.lastTriggeredAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Última activación:{" "}
                              {new Date(alert.lastTriggeredAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(alert)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(alert.id, alert.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAlert ? "Editar Alerta" : "Nueva Alerta"}</DialogTitle>
            <DialogDescription>
              Configura notificaciones automáticas por email
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="alert-name">Nombre</Label>
              <Input
                id="alert-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Alerta de Sobrecapacidad"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as Alert["type"] })}
              >
                <SelectTrigger id="alert-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-condition">Condición</Label>
              <Textarea
                id="alert-condition"
                value={formData.condition}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                placeholder="Ej: occupancy > 90, stock < 10, sessions_overlap"
                rows={2}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-threshold">Umbral (opcional)</Label>
              <Input
                id="alert-threshold"
                type="number"
                value={formData.threshold ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    threshold: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="Valor numérico"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="alert-emails">Emails (separados por coma)</Label>
              <Textarea
                id="alert-emails"
                value={formData.notifyEmails}
                onChange={(e) => setFormData({ ...formData, notifyEmails: e.target.value })}
                placeholder="admin@example.com, ops@example.com"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="alert-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="alert-active">Alerta activa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>{editingAlert ? "Actualizar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
