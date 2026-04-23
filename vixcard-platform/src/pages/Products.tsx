import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Package, ImagePlus, Video, Edit2, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { useTenant, TENANTS } from "../contexts/TenantContext";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import type { Product } from "../types";

const CATEGORIES = ["Cartões", "Carnês", "Etiquetas", "Impressão", "Serviços", "Outros"];

export function Products() {
  const tenant = useTenant();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [products, setProducts] = useState<Product[]>(
    // Get products from all tenants if super admin
    isSuperAdmin
      ? Object.values(TENANTS).flatMap((t) => t.products.map((p) => ({ ...p, tenantSlug: t.slug, tenantName: t.name } as Product & { tenantSlug: string; tenantName: string })))
      : tenant.products
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "Cartões" });

  const addProduct = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }
    const newProduct: Product = {
      id: `p-${Date.now()}`,
      name: form.name,
      description: form.description,
      category: form.category,
      active: true,
    };
    setProducts((prev) => [...prev, newProduct]);
    setForm({ name: "", description: "", category: "Cartões" });
    setShowForm(false);
    toast.success("Produto cadastrado!");
  };

  const toggleActive = (id: string) => {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));
  };

  const categories = [...new Set(products.map((p) => p.category))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Catálogo</p>
          <h1 className="font-display text-2xl font-extrabold">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie o catálogo disponível para cada cliente.
          </p>
        </div>
        {isSuperAdmin && (
          <Button variant="brand" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
        >
          <Card className="border-primary/20 bg-primary/3">
            <CardContent className="pt-5 space-y-4">
              <p className="font-semibold text-sm">Cadastrar Novo Produto</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="Ex: Cartão PVC Personalizado"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descreva o produto..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Upload placeholders */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div
                  className="flex items-center gap-3 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => toast.info("Upload de foto: integrar com backend.")}
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                  <div>
                    <p className="text-xs font-medium">Foto de referência</p>
                    <p className="text-[11px] text-muted-foreground">JPG, PNG</p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors"
                  onClick={() => toast.info("Upload de vídeo POP: integrar com backend.")}
                >
                  <Video className="h-5 w-5 text-muted-foreground/50" />
                  <div>
                    <p className="text-xs font-medium">Vídeo POP</p>
                    <p className="text-[11px] text-muted-foreground">MP4, MOV</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="brand" onClick={addProduct}>Cadastrar</Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Product list by category */}
      {categories.map((cat) => (
        <div key={cat}>
          <h2 className="text-xs uppercase tracking-widest font-semibold text-muted-foreground mb-3">
            {cat}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {products.filter((p) => p.category === cat).map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={`p-4 transition-all ${product.active ? "bg-gradient-card" : "opacity-50"}`}>
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{product.name}</p>
                        <Badge variant={product.active ? "success" : "muted"} className="flex-shrink-0 text-[10px]">
                          {product.active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>
                      )}
                    </div>
                  </div>
                  {isSuperAdmin && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => toast.info("Edição: integrar com backend.")}>
                          <Edit2 className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => toggleActive(product.id)}
                        >
                          {product.active
                            ? <><ToggleRight className="h-3.5 w-3.5 text-success" />Desativar</>
                            : <><ToggleLeft className="h-3.5 w-3.5" />Ativar</>
                          }
                        </Button>
                      </div>
                    </>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
