import { useState, useEffect } from "react";
import { X, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Product {
  id: string;
  type: string;
  name: string;
  price: number;
  currency: string;
  stock: number | null;
  isActive: boolean;
}

interface AddOn {
  productId: string;
  quantity: number;
}

interface SeatInspectorProps {
  seatId: string;
  seatLabel: string;
  venueId: string;
  currentAddOns?: AddOn[];
  onClose: () => void;
  onSave: (seatId: string, addOns: AddOn[]) => void;
}

export function SeatInspector({
  seatId,
  seatLabel,
  venueId,
  currentAddOns = [],
  onClose,
  onSave,
}: SeatInspectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [addOns, setAddOns] = useState<AddOn[]>(currentAddOns);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [venueId]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.listProducts(venueId, { isActive: true });
      setProducts(data.filter((p) => p.isActive));
    } catch (error) {
      console.error("Error loading products:", error);
      toast.error("Error al cargar productos");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error("Selecciona un producto");
      return;
    }

    if (quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return;

    // Check stock
    if (product.stock !== null && quantity > product.stock) {
      toast.error(`Stock insuficiente (disponible: ${product.stock})`);
      return;
    }

    // Check if product already added
    const existing = addOns.find((a) => a.productId === selectedProductId);
    if (existing) {
      toast.error("Producto ya agregado. Edita la cantidad.");
      return;
    }

    setAddOns([...addOns, { productId: selectedProductId, quantity }]);
    setSelectedProductId("");
    setQuantity(1);
  };

  const handleRemoveProduct = (productId: string) => {
    setAddOns(addOns.filter((a) => a.productId !== productId));
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveProduct(productId);
      return;
    }

    const product = products.find((p) => p.id === productId);
    if (product?.stock !== null && newQuantity > product.stock) {
      toast.error(`Stock insuficiente (disponible: ${product.stock})`);
      return;
    }

    setAddOns(
      addOns.map((a) => (a.productId === productId ? { ...a, quantity: newQuantity } : a))
    );
  };

  const handleSave = () => {
    onSave(seatId, addOns);
    onClose();
  };

  const getProductById = (id: string) => products.find((p) => p.id === id);

  const totalAddOnsPrice = addOns.reduce((sum, addOn) => {
    const product = getProductById(addOn.productId);
    return sum + (product?.price ?? 0) * addOn.quantity;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-lg">Inspector de Asiento</h3>
            <p className="text-sm text-muted-foreground">{seatLabel}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Add Product Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Agregar Producto
            </Label>

            <div className="flex gap-2">
              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
                disabled={loading || products.length === 0}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {product.price.toFixed(2)} {product.currency}
                      {product.stock !== null && ` (Stock: ${product.stock})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-20"
                placeholder="Cant."
              />

              <Button onClick={handleAddProduct} size="icon" disabled={!selectedProductId}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {loading && <p className="text-xs text-muted-foreground">Cargando productos...</p>}
            {!loading && products.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay productos activos disponibles
              </p>
            )}
          </div>

          <Separator />

          {/* Current Add-ons */}
          <div className="space-y-3">
            <Label>Productos Agregados ({addOns.length})</Label>

            {addOns.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay productos agregados
              </p>
            ) : (
              <div className="space-y-2">
                {addOns.map((addOn) => {
                  const product = getProductById(addOn.productId);
                  if (!product) return null;

                  return (
                    <div
                      key={addOn.productId}
                      className="flex items-center justify-between p-2 border rounded-md"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.price.toFixed(2)} {product.currency} × {addOn.quantity} ={" "}
                          {(product.price * addOn.quantity).toFixed(2)} {product.currency}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={addOn.quantity}
                          onChange={(e) =>
                            handleUpdateQuantity(addOn.productId, parseInt(e.target.value) || 1)
                          }
                          className="w-16 h-8 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveProduct(addOn.productId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {addOns.length > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="font-semibold">Total Add-ons:</span>
                <Badge variant="secondary" className="text-base">
                  {totalAddOnsPrice.toFixed(2)} MXN
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="flex-1">
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}
