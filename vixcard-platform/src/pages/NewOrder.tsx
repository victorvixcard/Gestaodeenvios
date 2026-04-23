import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Upload, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useOrders } from "../contexts/OrdersContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import type { OrderItem } from "../types";

export function NewOrder() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { addOrder } = useOrders();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [files, setFiles] = useState<string[]>([]);

  const addItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error("Selecione um produto e informe a quantidade.");
      return;
    }
    const product = tenant.products.find((p) => p.id === selectedProduct);
    if (!product) return;
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: parseInt(quantity),
        specifications,
      },
    ]);
    setSelectedProduct("");
    setQuantity("");
    setSpecifications("");
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Informe o título do pedido."); return; }
    if (items.length === 0) { toast.error("Adicione pelo menos um item."); return; }

    addOrder({
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      title,
      status: "pending",
      items,
      notes: [],
      requestedBy: user?.name ?? "Usuário",
      files,
    });

    toast.success("Pedido criado com sucesso!");
    navigate(`/${tenant.slug}/pedidos`);
  };

  const categories = [...new Set(tenant.products.map((p) => p.category))];

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-0.5">Pedidos</p>
          <h1 className="font-display text-2xl font-extrabold">Novo Pedido</h1>
        </div>
      </div>

      {/* Title */}
      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title">Título do pedido *</Label>
            <Input
              id="title"
              placeholder="Ex: Cartões PVC — Lote Abril 2025"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader><CardTitle>Itens do Pedido</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* Selected items */}
          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{item.productName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="default" className="text-[11px]">
                        {item.quantity.toLocaleString("pt-BR")} un
                      </Badge>
                      {item.specifications && (
                        <span className="text-xs text-muted-foreground truncate">{item.specifications}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    onClick={() => removeItem(i)}
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </motion.div>
              ))}
              <Separator />
            </div>
          )}

          {/* Add item */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Adicionar item
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>Produto</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <div key={cat}>
                        <p className="px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                          {cat}
                        </p>
                        {tenant.products
                          .filter((p) => p.category === cat && p.active)
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="qty">Quantidade</Label>
                  <Input
                    id="qty"
                    type="number"
                    min="1"
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="specs">Especificações</Label>
                  <Input
                    id="specs"
                    placeholder="Ex: laminação fosca"
                    value={specifications}
                    onChange={(e) => setSpecifications(e.target.value)}
                  />
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={addItem}>
                <Plus className="h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File upload simulation */}
      <Card>
        <CardHeader><CardTitle>Arquivos de Layout</CardTitle></CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-colors"
            onClick={() => {
              const name = `layout-${Date.now()}.pdf`;
              setFiles((prev) => [...prev, name]);
              toast.success(`Arquivo "${name}" anexado (simulação).`);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Clique para anexar arquivo de layout</p>
            <p className="text-xs text-muted-foreground/50 mt-1">PDF, AI, CDR, PSD — até 50MB</p>
          </div>
          {files.length > 0 && (
            <div className="mt-3 space-y-1">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-success" />
                  {f}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button variant="brand" className="flex-1" onClick={handleSubmit}>
          <Send className="h-4 w-4" />
          Enviar Pedido
        </Button>
      </div>
    </div>
  );
}
