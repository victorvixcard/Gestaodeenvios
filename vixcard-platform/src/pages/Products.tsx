import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Package, Search, ImagePlus, Video, Pencil,
  Power, PowerOff, Boxes, TrendingDown, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import type { Product } from "../types";

const CATEGORIES = ["Cartões", "Carnês", "Etiquetas", "Impressão", "Serviços", "Outros"];

const EMPTY_FORM = {
  name: "", description: "", category: "Cartões", stock: 0, imageUrl: "", videoUrl: "", active: true,
};

function StockBadge({ stock }: { stock: number }) {
  if (stock > 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-success">
      <TrendingUp className="h-3 w-3" />{stock} un
    </span>
  );
  if (stock < 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-destructive">
      <TrendingDown className="h-3 w-3" />{stock} un
    </span>
  );
  return <span className="text-[10px] font-semibold text-muted-foreground">Sem estoque</span>;
}

export function Products() {
  const { user } = useAuth();
  const { products, addProduct, updateProduct } = useData();
  const isSuperAdmin = user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const imageRef = useRef<HTMLInputElement>(null);

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.code.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "Todos" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setDialog("create");
  };

  const openEdit = (product: Product) => {
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      stock: product.stock,
      imageUrl: product.imageUrl ?? "",
      videoUrl: product.videoUrl ?? "",
      active: product.active,
    });
    setEditId(product.id);
    setDialog("edit");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem muito grande. Máximo 5MB."); return; }
    const reader = new FileReader();
    reader.onloadend = () => setForm((f) => ({ ...f, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }

    if (dialog === "create") {
      addProduct({
        name: form.name,
        description: form.description,
        category: form.category,
        stock: Number(form.stock),
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        active: form.active,
      });
      toast.success("Produto cadastrado!");
    } else if (editId) {
      updateProduct(editId, {
        name: form.name,
        description: form.description,
        category: form.category,
        stock: Number(form.stock),
        imageUrl: form.imageUrl || undefined,
        videoUrl: form.videoUrl || undefined,
        active: form.active,
      });
      toast.success("Produto atualizado!");
    }
    setDialog(null);
  };

  const toggleActive = (product: Product) => {
    updateProduct(product.id, { active: !product.active });
    toast.success(product.active ? "Produto desativado." : "Produto ativado.");
  };

  const allCategories = ["Todos", ...CATEGORIES];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo global com código, estoque e foto de referência.
          </p>
        </div>
        {isSuperAdmin && (
          <Button variant="brand" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",    value: products.length,                                icon: Package,      color: "text-primary bg-primary/10" },
          { label: "Ativos",   value: products.filter((p) => p.active).length,        icon: Power,        color: "text-success bg-success/10" },
          { label: "Em estoque", value: products.filter((p) => p.stock > 0).length,  icon: TrendingUp,   color: "text-accent bg-accent/10" },
          { label: "Produzindo", value: products.filter((p) => p.stock < 0).length,  icon: Boxes,        color: "text-warning bg-warning/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="p-4 bg-gradient-card">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="font-display text-2xl font-extrabold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
          <Input
            placeholder="Buscar por nome ou código..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                categoryFilter === cat
                  ? "bg-primary text-white border-primary"
                  : "border-border hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum produto encontrado.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className={cn("overflow-hidden transition-all hover:shadow-brand hover:-translate-y-0.5", !product.active && "opacity-60")}>
                {/* Image */}
                <div className="relative h-40 bg-muted/50 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-12 w-12 text-muted-foreground/20" />
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <Badge variant="muted" className="text-[10px] bg-black/40 text-white border-0">
                      {product.category}
                    </Badge>
                    {product.videoUrl && (
                      <Badge className="text-[10px] bg-accent text-accent-foreground border-0">
                        <Video className="h-2.5 w-2.5 mr-1" />POP
                      </Badge>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant={product.active ? "success" : "muted"} className="text-[10px]">
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold leading-tight">{product.name}</p>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground mb-2">{product.code}</p>
                  {product.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Estoque</span>
                    <StockBadge stock={product.stock} />
                  </div>

                  {isSuperAdmin && (
                    <>
                      <Separator className="mb-3" />
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEdit(product)}>
                          <Pencil className="h-3 w-3" />Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn("flex-1 text-xs", product.active ? "text-destructive hover:bg-destructive/10 hover:text-destructive" : "text-success hover:bg-success/10 hover:text-success")}
                          onClick={() => toggleActive(product)}
                        >
                          {product.active ? <><PowerOff className="h-3 w-3" />Off</> : <><Power className="h-3 w-3" />On</>}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Novo Produto" : "Editar Produto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
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
              <div className="space-y-1.5">
                <Label>Estoque inicial</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground">Pode ser negativo (em produção)</p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva o produto..."
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>

            {/* Photo upload */}
            <div className="space-y-2">
              <Label>Foto de referência</Label>
              <input ref={imageRef} type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
              {form.imageUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-border h-36">
                  <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 text-xs"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  >
                    Remover
                  </Button>
                </div>
              ) : (
                <div
                  className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  onClick={() => imageRef.current?.click()}
                >
                  <ImagePlus className="h-7 w-7 text-muted-foreground/40" />
                  <p className="text-xs text-muted-foreground">Clique para enviar JPG ou PNG (máx. 5MB)</p>
                </div>
              )}
            </div>

            {/* Video URL */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" />
                URL do vídeo POP (opcional)
              </Label>
              <Input
                placeholder="https://youtube.com/..."
                value={form.videoUrl}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button variant="brand" onClick={handleSave}>
              {dialog === "create" ? "Cadastrar Produto" : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
