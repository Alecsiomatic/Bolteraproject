import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Mail, Shield, Edit, Trash2, UserCheck, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL } from "@/lib/api-base";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLogin: string | null;
  createdAt: string;
}

const fetchUsers = async (): Promise<User[]> => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al cargar usuarios");
  const data = await response.json();
  return data.users || data;
};

const createUser = async (data: { name: string; email: string; password: string; role: string }) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Error al crear usuario");
  }
  return response.json();
};

const updateUser = async ({ userId, data }: { userId: string; data: Partial<User> }) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Error al actualizar");
  return response.json();
};

const deleteUser = async (userId: string) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Error al eliminar");
  return response.json();
};

const AdminUsers = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", role: "VIEWER" });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreateModal(false);
      setNewUser({ name: "", email: "", password: "", role: "VIEWER" });
      toast.success("Usuario creado correctamente");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingUser(null);
      toast.success("Usuario actualizado");
    },
    onError: () => toast.error("Error al actualizar usuario"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Usuario eliminado");
    },
    onError: () => toast.error("Error al eliminar usuario"),
  });

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { color: string; label: string }> = {
      ADMIN: { color: "text-purple-200 border-purple-300/30", label: "Administrador" },
      OPERATOR: { color: "text-cyan-200 border-cyan-300/30", label: "Operador" },
      VIEWER: { color: "text-slate-200 border-white/20", label: "Usuario" },
    };
    return variants[role.toUpperCase()] || variants.VIEWER;
  };

  const getStatusBadge = (status: string) => {
    return status === "ACTIVE"
      ? { color: "text-emerald-200 border-emerald-300/30", label: "Activo" }
      : { color: "text-rose-200 border-rose-300/30", label: "Inactivo" };
  };

  const handleCreate = () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      toast.error("Completa todos los campos");
      return;
    }
    createMutation.mutate(newUser);
  };

  const handleUpdateRole = (user: User, newRole: string) => {
    updateMutation.mutate({ userId: user.id, data: { role: newRole } });
  };

  const handleUpdateStatus = (user: User) => {
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    updateMutation.mutate({ userId: user.id, data: { status: newStatus } });
  };

  const handleDelete = (user: User) => {
    if (confirm(`¿Eliminar a ${user.name}?`)) {
      deleteMutation.mutate(user.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8 px-2 py-4 text-white lg:px-0">
      {/* Header */}
      <div className="flex flex-col gap-6 rounded-[32px] border border-white/10 bg-white/5 px-6 py-6 backdrop-blur-2xl md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-300">Usuarios</p>
          <h1 className="text-3xl font-semibold">Gestión de Usuarios</h1>
          <p className="text-slate-300">{users.length} usuarios registrados</p>
        </div>
        <Button className="px-6 py-5" onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <Input
          placeholder="Buscar usuarios por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-3xl border-white/10 bg-white/5 pl-12 text-white placeholder:text-slate-500"
        />
      </div>

      {/* Users Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredUsers.map((user) => {
          const roleBadge = getRoleBadge(user.role);
          const statusBadge = getStatusBadge(user.status);

          return (
            <Card key={user.id}>
              <CardHeader>
                <CardTitle className="flex items-start justify-between text-white">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400/30 to-violet-500/30 font-semibold text-white">
                        {user.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div>
                        <p className="font-semibold">{user.name}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-2xl"
                      onClick={() => setEditingUser(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-2xl text-rose-400"
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription className="flex items-center gap-2 text-slate-400">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Badge className={`border bg-white/5 px-3 py-1 text-xs ${roleBadge.color}`}>
                      <Shield className="mr-1 h-3 w-3" />
                      {roleBadge.label}
                    </Badge>
                    <Badge
                      className={`cursor-pointer border bg-white/5 px-3 py-1 text-xs ${statusBadge.color}`}
                      onClick={() => handleUpdateStatus(user)}
                    >
                      <UserCheck className="mr-1 h-3 w-3" />
                      {statusBadge.label}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Creado</span>
                      <span className="font-medium">
                        {new Date(user.createdAt).toLocaleDateString("es-ES")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Último acceso</span>
                      <span className="font-medium">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString("es-ES")
                          : "Nunca"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredUsers.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 py-12 text-center text-slate-400">
          <Shield className="mx-auto mb-4 h-12 w-12 text-slate-500" />
          <p>No se encontraron usuarios</p>
        </div>
      )}

      {/* Create User Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="border-white/10 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Crear Usuario</DialogTitle>
            <DialogDescription>Agrega un nuevo usuario al sistema</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                placeholder="Juan Pérez"
                className="border-white/20 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))}
                placeholder="juan@ejemplo.com"
                className="border-white/20 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                placeholder="Mínimo 8 caracteres"
                className="border-white/20 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={newUser.role} onValueChange={(v) => setNewUser((p) => ({ ...p, role: v }))}>
                <SelectTrigger className="border-white/20 bg-white/5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">Usuario</SelectItem>
                  <SelectItem value="OPERATOR">Operador</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Usuario
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="border-white/10 bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-white">Editar Usuario</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select
                  value={editingUser.role}
                  onValueChange={(v) => handleUpdateRole(editingUser, v)}
                >
                  <SelectTrigger className="border-white/20 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VIEWER">Usuario</SelectItem>
                    <SelectItem value="OPERATOR">Operador</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={editingUser.status}
                  onValueChange={(v) =>
                    updateMutation.mutate({ userId: editingUser.id, data: { status: v } })
                  }
                >
                  <SelectTrigger className="border-white/20 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Activo</SelectItem>
                    <SelectItem value="INACTIVE">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
