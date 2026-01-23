import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Package } from "lucide-react";
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
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Product {
  id: string;
  venueId: string;
  type: "food" | "beverage" | "parking" | "merchandise" | "gift" | "other";
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number | null;
  isActive: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductCatalogProps {
  venueId: string;
}

const PRODUCT_TYPES = [
  { value: "food", label: "Comida", icon: "🍔" },
  { value: "beverage", label: "Bebida", icon: "🥤" },
  { value: "parking", label: "Estacionamiento", icon: "🅿️" },
  { value: "merchandise", label: "Mercancía", icon: "👕" },
  { value: "gift", label: "Regalo", icon: "🎁" },
  { value: "other", label: "Otro", icon: "📦" },
];

export function ProductCatalog({ venueId }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const [formData, setFormData] = useState({
    type: "food" as Product["type"],
    name: "",
    description: "",
    price: 0,
    currency: "MXN",
    stock: null as number | null,
    isActive: true,
  });

  useEffect(() => {
    loadProducts();
  }, [venueId, filterType]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const filters = filterType !== "all" ? { type: filterType } : undefined;
      const data = await api.listProducts(venueId, filters);
      setProducts(data as Product[]);
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingProduct(null);
    setFormData({
      type: "food",
      name: "",
      description: "",
      price: 0,
      currency: "MXN",
      stock: null,
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      type: product.type,
      name: product.name,
      description: product.description ?? "",
      price: product.price,
      currency: product.currency,
      stock: product.stock,
      isActive: product.isActive,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (formData.price < 0) {
      toast.error("El precio no puede ser negativo");
      return;
    }

    try {
      if (editingProduct) {
        await api.updateProduct(venueId, editingProduct.id, {
          type: formData.type,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          price: formData.price,
          currency: formData.currency,
          stock: formData.stock,
          isActive: formData.isActive,
        });
        toast.success("Producto actualizado");
      } else {
        await api.createProduct(venueId, {
          type: formData.type,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          price: formData.price,
          currency: formData.currency,
          stock: formData.stock,
          isActive: formData.isActive,
        });
        toast.success("Producto creado");
      }

      setShowDialog(false);
      loadProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error("Error al guardar producto");
    }
  };

  const handleDelete = async (productId: string, productName: string) => {
    if (!confirm(`¿Eliminar producto "${productName}"?`)) return;

    try {
      await api.deleteProduct(venueId, productId);
      toast.success("Producto eliminado");
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
      toast.error("Error al eliminar producto");
    }
  };

  const getTypeIcon = (type: string) => {
    return PRODUCT_TYPES.find((t) => t.value === type)?.icon ?? "📦";
  };

  const filteredProducts = products;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Catálogo de Productos
            </CardTitle>
            <CardDescription>
              Complementos y productos adicionales para asientos
            </CardDescription>
          </div>
          <Button onClick={handleCreate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="mb-4">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {PRODUCT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Cargando...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No hay productos. Crea uno para comenzar.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getTypeIcon(product.type)}</span>
                      <div>
                        <CardTitle className="text-sm">{product.name}</CardTitle>
                        <Badge variant={product.isActive ? "default" : "secondary"} className="mt-1">
                          {product.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(product.id, product.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {product.description && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {product.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">
                      {product.price.toFixed(2)} {product.currency}
                    </span>
                    {product.stock !== null && (
                      <span className="text-xs text-muted-foreground">
                        Stock: {product.stock}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? "Editar Producto" : "Nuevo Producto"}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del producto o complemento
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product-type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v as Product["type"] })}
              >
                <SelectTrigger id="product-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-name">Nombre</Label>
              <Input
                id="product-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Combo Hot Dog"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-description">Descripción (opcional)</Label>
              <Textarea
                id="product-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe el producto..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="product-price">Precio</Label>
                <Input
                  id="product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="product-currency">Moneda</Label>
                <Input
                  id="product-currency"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="product-stock">Stock (opcional)</Label>
              <Input
                id="product-stock"
                type="number"
                min="0"
                value={formData.stock ?? ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    stock: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Dejar vacío para stock ilimitado"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="product-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="product-active">Producto activo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingProduct ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
