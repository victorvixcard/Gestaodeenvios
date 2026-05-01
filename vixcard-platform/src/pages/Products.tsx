import { useState } from "react";
import { motion } from "framer-motion";
import {
  Plus, Package, Search, Video, Pencil,
  Power, PowerOff, Boxes, TrendingDown, TrendingUp, Trash2, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLog } from "../contexts/LogsContext";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../lib/utils";
import { AvatarUpload } from "../components/shared/AvatarUpload";
import type { Product, ProductVariation, VariationOption } from "../types";

const CATEGORIES = ["Cartões", "Carnês", "Etiquetas", "Impressão", "Serviços", "Outros"];

const EMPTY_FORM = {
  name: "", description: "", category: "Cartões", price: 0, stock: 0, imageUrl: "", videoUrl: "", active: true,
  variations: [] as ProductVariation[],
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
  const { addLog } = useLog();
  const isSuperAdmin = user?.role === "super_admin";

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

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
      price: product.price ?? 0,
      active: product.active,
      variations: product.variations ?? [],
    });
    setEditId(product.id);
    setDialog("edit");
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do produto."); return; }

    if (dialog === "create") {
      addProduct({
        name: form.name, description: form.description, category: form.category,
        price: Number(form.price), stock: Number(form.stock),
        imageUrl: form.imageUrl || undefined, videoUrl: form.videoUrl || undefined, active: form.active,
        variations: form.variations.length > 0 ? form.variations : undefined,
      });
      addLog({
        action: "produto_criado", entityType: "Produto", entityId: `new-${Date.now()}`, entityName: form.name,
        userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
        tenantSlug: "sistemalegado", details: `Categoria: ${form.category}`,
      });
      toast.success("Produto cadastrado!");
    } else if (editId) {
      const product = products.find((p) => p.id === editId);
      updateProduct(editId, {
        name: form.name, description: form.description, category: form.category,
        price: Number(form.price), stock: Number(form.stock),
        imageUrl: form.imageUrl || undefined, videoUrl: form.videoUrl || undefined, active: form.active,
        variations: form.variations.length > 0 ? form.variations : undefined,
      });
      addLog({
        action: "produto_atualizado", entityType: "Produto", entityId: editId, entityName: form.name,
        userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
        tenantSlug: "sistemalegado", details: product ? `Editado: ${product.name}` : undefined,
      });
      toast.success("Produto atualizado!");
    }
    setDialog(null);
  };

  const toggleActive = (product: Product) => {
    updateProduct(product.id, { active: !product.active });
    addLog({
      action: product.active ? "produto_desativado" : "produto_ativado",
      entityType: "Produto", entityId: product.id, entityName: product.name,
      userName: user?.name ?? "", userEmail: user?.email ?? "", userRole: user?.role ?? "super_admin",
      tenantSlug: "sistemalegado",
    });
    toast.success(product.active ? "Produto desativado." : "Produto ativado.");
  };

  // ── Variation helpers ─────────────────────────────────────────────────────────
  const addVariation = () =>
    setForm((f) => ({
      ...f,
      variations: [...f.variations, { id: `v-${Date.now()}`, name: "", required: false, options: [] }],
    }));

  const removeVariation = (vi: number) =>
    setForm((f) => ({ ...f, variations: f.variations.filter((_, i) => i !== vi) }));

  const updateVariation = (vi: number, updates: Partial<ProductVariation>) =>
    setForm((f) => ({
      ...f,
      variations: f.variations.map((v, i) => (i === vi ? { ...v, ...updates } : v)),
    }));

  const addOption = (vi: number) =>
    setForm((f) => ({
      ...f,
      variations: f.variations.map((v, i) =>
        i === vi
          ? { ...v, options: [...v.options, { id: `o-${Date.now()}-${vi}`, label: "" }] }
          : v
      ),
    }));

  const removeOption = (vi: number, oi: number) =>
    setForm((f) => ({
      ...f,
      variations: f.variations.map((v, i) =>
        i === vi ? { ...v, options: v.options.filter((_, j) => j !== oi) } : v
      ),
    }));

  const updateOption = (vi: number, oi: number, updates: Partial<VariationOption>) =>
    setForm((f) => ({
      ...f,
      variations: f.variations.map((v, i) =>
        i === vi
          ? { ...v, options: v.options.map((o, j) => (j === oi ? { ...o, ...updates } : o)) }
          : v
      ),
    }));

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
                  <div className="absolute top-2 left-2 flex gap-1 flex-wrap">
                    <Badge variant="muted" className="text-[10px] bg-black/40 text-white border-0">
                      {product.category}
                    </Badge>
                    {product.videoUrl && (
                      <Badge className="text-[10px] bg-accent text-accent-foreground border-0">
                        <Video className="h-2.5 w-2.5 mr-1" />POP
                      </Badge>
                    )}
                    {product.variations && product.variations.length > 0 && (
                      <Badge className="text-[10px] bg-primary/80 text-white border-0">
                        <Settings2 className="h-2.5 w-2.5 mr-1" />{product.variations.length} var.
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

                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Estoque</span>
                    <StockBadge stock={product.stock} />
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Preço unit.</span>
                    <span className="text-[11px] font-semibold text-foreground">
                      {product.price != null && product.price > 0
                        ? `R$ ${product.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : <span className="text-muted-foreground">—</span>}
                    </span>
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
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-0 flex-shrink-0">
            <DialogTitle>{dialog === "create" ? "Novo Produto" : "Editar Produto"}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="geral" className="flex flex-col flex-1 min-h-0">
            {/* Tab list */}
            <div className="px-6 pt-3 flex-shrink-0 border-b border-border">
              <TabsList className="h-9 gap-0 bg-transparent p-0 w-auto">
                <TabsTrigger
                  value="geral"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm font-medium"
                >
                  Geral
                </TabsTrigger>
                <TabsTrigger
                  value="variacoes"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-sm font-medium flex items-center gap-1.5"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Variações
                  {form.variations.length > 0 && (
                    <span className="ml-1 bg-primary text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center leading-none">
                      {form.variations.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── ABA GERAL ─────────────────────────────────────────── */}
            <TabsContent value="geral" className="flex-1 overflow-y-auto px-6 py-4 mt-0 space-y-4">
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
                  <Label>Preço unitário (R$)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                    <Input
                      type="number" min={0} step={0.01} placeholder="0,00" className="pl-9"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Estoque inicial</Label>
                  <Input
                    type="number" placeholder="0"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">Pode ser negativo (em produção)</p>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Descrição</Label>
                  <Textarea
                    placeholder="Descreva o produto..." rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Foto de referência</Label>
                <div className="flex items-center gap-4">
                  <AvatarUpload
                    size="lg" shape="rect" aspect={4 / 3}
                    currentUrl={form.imageUrl || undefined}
                    initials={form.name ? form.name.substring(0, 2).toUpperCase() : "PR"}
                    title="Foto do produto" hint="JPG, PNG, WEBP ou HEIC — qualquer formato."
                    onSave={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
                  />
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-foreground">Clique na imagem para selecionar</p>
                    <p>Suporta JPG, PNG, WEBP e HEIC (iPhone).</p>
                    {form.imageUrl && (
                      <button type="button" className="text-destructive hover:underline"
                        onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}>
                        Remover foto
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
            </TabsContent>

            {/* ── ABA VARIAÇÕES ─────────────────────────────────────── */}
            <TabsContent value="variacoes" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Grupos de variação</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ex: Laminação, Chip, Furo, Tarja — cada grupo tem suas opções.
                    </p>
                  </div>
                  <Button type="button" variant="brand" size="sm" className="h-8 px-3 text-xs gap-1.5 flex-shrink-0" onClick={addVariation}>
                    <Plus className="h-3.5 w-3.5" />
                    Novo grupo
                  </Button>
                </div>

                {/* Empty state */}
                {form.variations.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-xl border border-dashed border-border text-center">
                    <Settings2 className="h-8 w-8 text-muted-foreground/30" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma variação configurada</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        Clique em "Novo grupo" para adicionar
                      </p>
                    </div>
                  </div>
                )}

                {/* Variation groups */}
                {form.variations.map((variation, vi) => (
                  <div key={variation.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    {/* Group header bar */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                      <Input
                        className="flex-1 h-8 font-semibold text-sm bg-transparent border-0 px-0 shadow-none focus-visible:ring-0 placeholder:font-normal"
                        placeholder="Nome do grupo (ex: Laminação)"
                        value={variation.name}
                        onChange={(e) => updateVariation(vi, { name: e.target.value })}
                      />
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer whitespace-nowrap select-none">
                        <input
                          type="checkbox"
                          checked={variation.required}
                          onChange={(e) => updateVariation(vi, { required: e.target.checked })}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        Obrigatório
                      </label>
                      <Button
                        type="button" variant="ghost" size="icon-sm"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        onClick={() => removeVariation(vi)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Options list */}
                    <div className="p-3 space-y-2">
                      {variation.options.length === 0 && (
                        <p className="text-xs text-muted-foreground/60 text-center py-2">
                          Nenhuma opção ainda — clique em "+ Adicionar opção"
                        </p>
                      )}

                      {variation.options.map((opt, oi) => (
                        <div key={opt.id} className="space-y-1.5">
                          {/* Option row — visual de checkbox + nome + toggle especificar */}
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                            {/* Checkbox decorativo (preview de como vai aparecer) */}
                            <div className="h-4 w-4 rounded border-2 border-border bg-muted flex-shrink-0" />

                            <Input
                              className="flex-1 h-7 text-sm bg-transparent border-0 px-0 shadow-none focus-visible:ring-0"
                              placeholder="Nome da opção (ex: Fosca)"
                              value={opt.label}
                              onChange={(e) => updateOption(vi, oi, { label: e.target.value })}
                            />

                            <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap select-none shrink-0"
                              title="Ao marcar esta opção no pedido, abre um campo para o usuário digitar">
                              <input
                                type="checkbox"
                                checked={!!opt.requiresText}
                                onChange={(e) => updateOption(vi, oi, {
                                  requiresText: e.target.checked,
                                  textPlaceholder: e.target.checked ? (opt.textPlaceholder ?? "") : undefined,
                                })}
                                className="h-3.5 w-3.5 accent-primary"
                              />
                              <span className={opt.requiresText ? "text-primary font-medium" : "text-muted-foreground"}>
                                Especificar
                              </span>
                            </label>

                            <Button
                              type="button" variant="ghost" size="icon-sm"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                              onClick={() => removeOption(vi, oi)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>

                          {/* Campo de placeholder — aparece quando "Especificar" está marcado */}
                          {opt.requiresText && (
                            <div className="ml-8 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                              <div className="w-0.5 h-full bg-primary/30 rounded-full self-stretch" />
                              <div className="flex-1 space-y-1">
                                <p className="text-[10px] text-primary font-medium">
                                  Texto de ajuda para o campo livre:
                                </p>
                                <Input
                                  className="h-7 text-xs bg-white"
                                  placeholder='Ex: "Informe a frequência do chip"'
                                  value={opt.textPlaceholder ?? ""}
                                  onChange={(e) => updateOption(vi, oi, { textPlaceholder: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <Button
                        type="button" variant="ghost" size="sm"
                        className="h-8 w-full text-xs text-muted-foreground border border-dashed border-border hover:bg-muted/50 rounded-lg mt-1"
                        onClick={() => addOption(vi)}
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar opção
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="px-6 py-4 border-t border-border flex-shrink-0 gap-2">
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
