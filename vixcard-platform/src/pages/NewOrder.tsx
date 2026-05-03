import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Upload, Send, Check, X, FileText, FileImage, File as FileIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { useData } from "../contexts/DataContext";
import { useOrders } from "../contexts/OrdersContext";
import { useLog } from "../contexts/LogsContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import type { OrderFile, OrderItem, SelectedVariation } from "../types";

export function NewOrder() {
  const { user } = useAuth();
  const tenant = useTenant();
  const { products: allProducts, companies } = useData();
  const { addOrder } = useOrders();
  const { addLog } = useLog();

  // Super-admin sees all products → filter by company's allowedProductIds.
  // Other roles: backend already returns only allowed products for their company.
  const company = companies.find((c) => c.slug === tenant.slug);
  const allowedProducts = user?.role === 'super_admin'
    ? allProducts.filter((p) => p.active && (company?.allowedProductIds ?? []).includes(p.id))
    : allProducts.filter((p) => p.active);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [selectedVariations, setSelectedVariations] = useState<Record<string, { optionId: string; extraText: string }>>({});
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const newFiles: OrderFile[] = picked.map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...newFiles]);
    setRawFiles((prev) => [...prev, ...picked]);
    toast.success(`${picked.length} arquivo(s) anexado(s).`);
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
    setRawFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (type: string) => {
    if (type.startsWith("image/")) return <FileImage className="h-4 w-4 text-blue-500" />;
    if (type === "application/pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <FileIcon className="h-4 w-4 text-muted-foreground" />;
  };

  const openItemForm = () => {
    setSelectedProduct("");
    setQuantity("");
    setSpecifications("");
    setSelectedVariations({});
    setShowItemForm(true);
  };

  const cancelItemForm = () => {
    setShowItemForm(false);
    setSelectedProduct("");
    setQuantity("");
    setSpecifications("");
    setSelectedVariations({});
  };

  const incluirItem = () => {
    if (!selectedProduct || !quantity) {
      toast.error("Selecione um produto e informe a quantidade.");
      return;
    }
    const product = allowedProducts.find((p) => p.id === selectedProduct);
    if (!product) return;

    const missingRequired = (product.variations ?? []).filter(
      (v) => v.required && !selectedVariations[v.id]?.optionId
    );
    if (missingRequired.length > 0) {
      toast.error(`Selecione: ${missingRequired.map((v) => v.name).join(", ")}`);
      return;
    }

    const variationsList: SelectedVariation[] = Object.entries(selectedVariations)
      .filter(([, sel]) => sel.optionId)
      .map(([varId, sel]) => {
        const variation = product.variations?.find((v) => v.id === varId);
        const option = variation?.options.find((o) => o.id === sel.optionId);
        return {
          variationId: varId,
          variationName: variation?.name ?? "",
          optionId: sel.optionId,
          optionLabel: option?.label ?? "",
          extraText: sel.extraText || undefined,
        };
      });

    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        quantity: parseInt(quantity),
        specifications,
        selectedVariations: variationsList.length > 0 ? variationsList : undefined,
      },
    ]);
    setShowItemForm(false);
    setSelectedProduct("");
    setQuantity("");
    setSpecifications("");
    setSelectedVariations({});
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Informe o título do pedido."); return; }
    if (items.length === 0) { toast.error("Adicione pelo menos um item."); return; }

    setSubmitting(true);
    try {
      const created = await addOrder({
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        title,
        status: "pending",
        items,
        notes: [],
        requestedBy: user?.name ?? "Usuário",
        files: [],
      }, rawFiles);

      addLog({
        action: "pedido_criado",
        entityType: "Pedido",
        entityId: created.id,
        entityName: title,
        userName: user?.name ?? "Usuário",
        userEmail: user?.email ?? "",
        userRole: user?.role ?? "operator",
        tenantSlug: tenant.slug,
        details: `${items.length} item(s): ${items.map((i) => `${i.productName} × ${i.quantity}`).join(", ")}`,
      });
      toast.success("Pedido criado com sucesso!");
      navigate(`/${tenant.slug}/pedidos`);
    } catch {
      toast.error("Erro ao criar o pedido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [...new Set(allowedProducts.map((p) => p.category))];

  const CATEGORY_COLOR: Record<string, string> = {
    "Cartões":   "bg-blue-500",
    "Carnês":    "bg-emerald-500",
    "Etiquetas": "bg-orange-500",
    "Serviços":  "bg-purple-500",
    "Impressão": "bg-slate-500",
  };

  const productThumb = (category: string, imageUrl?: string) => {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt=""
          className="w-7 h-7 rounded-md object-cover border border-border"
        />
      );
    }
    const color = CATEGORY_COLOR[category] ?? "bg-primary";
    return (
      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[9px] font-bold text-white ${color}`}>
        {category.slice(0, 2).toUpperCase()}
      </div>
    );
  };

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
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <Badge variant="default" className="text-[11px]">
                        {item.quantity.toLocaleString("pt-BR")} un
                      </Badge>
                      {item.selectedVariations?.map((sv) => (
                        <span key={sv.variationId} className="text-[11px] text-muted-foreground">
                          {sv.variationName}: <span className="font-medium text-foreground">{sv.optionLabel}{sv.extraText ? ` (${sv.extraText})` : ""}</span>
                        </span>
                      ))}
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

          {/* Botão abrir formulário */}
          <AnimatePresence mode="wait">
            {!showItemForm && (
              <motion.div
                key="add-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <Button variant="outline" className="w-full" onClick={openItemForm}>
                  <Plus className="h-4 w-4" />
                  Adicionar Item
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulário de item */}
          <AnimatePresence mode="wait">
            {showItemForm && (
              <motion.div
                key="item-form"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3 rounded-xl border border-primary/20 bg-primary/3 p-4"
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Novo item
                </p>

                <div className="space-y-1.5">
                  <Label>Produto</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectGroup key={cat}>
                          <div className="px-2 pt-2 pb-0.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{cat}</div>
                          {allowedProducts
                            .filter((p) => p.category === cat)
                            .map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                thumbnail={productThumb(p.category, p.imageUrl)}
                              >
                                <span className="font-mono text-xs text-muted-foreground mr-2">{p.code}</span>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      ))}
                      {allowedProducts.length === 0 && (
                        <SelectItem value="__empty__" disabled>
                          Nenhum produto disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Variation selector — shown when selected product has variations */}
                {(() => {
                  const prod = allowedProducts.find((p) => p.id === selectedProduct);
                  if (!prod?.variations?.length) return null;
                  return (
                    <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/3 p-4">
                      <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                        Especificações do produto
                      </p>
                      {prod.variations.map((variation) => {
                        const sel = selectedVariations[variation.id];
                        return (
                          <div key={variation.id} className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">
                              {variation.name}
                              {variation.required
                                ? <span className="text-destructive ml-0.5">*</span>
                                : <span className="text-muted-foreground font-normal ml-1">(opcional)</span>}
                            </p>
                            <div className="space-y-1.5">
                              {variation.options.map((opt) => {
                                const isChecked = sel?.optionId === opt.id;
                                return (
                                  <div key={opt.id} className="space-y-1.5">
                                    {/* Checkbox row */}
                                    <label className={cn(
                                      "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all select-none",
                                      isChecked
                                        ? "border-primary/40 bg-primary/8 text-foreground"
                                        : "border-border bg-background hover:bg-muted/50"
                                    )}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() =>
                                          setSelectedVariations((prev) => ({
                                            ...prev,
                                            [variation.id]: isChecked
                                              ? { optionId: "", extraText: "" }
                                              : { optionId: opt.id, extraText: "" },
                                          }))
                                        }
                                        className="h-4 w-4 accent-primary flex-shrink-0"
                                      />
                                      <span className="text-sm">{opt.label}</span>
                                    </label>

                                    {/* Campo livre — aparece só quando marcado E requer texto */}
                                    {isChecked && opt.requiresText && (
                                      <div className="ml-7">
                                        <Input
                                          className="h-8 text-sm"
                                          placeholder={opt.textPlaceholder ?? "Especifique..."}
                                          value={sel?.extraText ?? ""}
                                          autoFocus
                                          onChange={(e) =>
                                            setSelectedVariations((prev) => ({
                                              ...prev,
                                              [variation.id]: { ...prev[variation.id], extraText: e.target.value },
                                            }))
                                          }
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

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
                    <Label htmlFor="specs">Observações</Label>
                    <Input
                      id="specs"
                      placeholder="Ex: urgente, cor especial..."
                      value={specifications}
                      onChange={(e) => setSpecifications(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" className="flex-1" onClick={cancelItemForm}>
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button variant="brand" className="flex-1" onClick={incluirItem}>
                    <Check className="h-4 w-4" />
                    Incluir
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Arquivos para produção */}
      <Card>
        <CardHeader><CardTitle>Arquivos para Produção</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {/* Drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const dropped = Array.from(e.dataTransfer.files);
              const newFiles: OrderFile[] = dropped.map((f) => ({
                name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f),
              }));
              setFiles((prev) => [...prev, ...newFiles]);
              toast.success(`${dropped.length} arquivo(s) anexado(s).`);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Clique ou arraste os arquivos aqui</p>
            <p className="text-xs text-muted-foreground/50 mt-1">PDF, AI, CDR, PSD, PNG, JPG — qualquer formato</p>
          </div>

          {/* Lista de arquivos */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              <AnimatePresence>
                {files.map((f, i) => (
                  <motion.div
                    key={f.url}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30"
                  >
                    {fileIcon(f.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={() => removeFile(i)}
                      aria-label="Remover arquivo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3 pb-6">
        <Button variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>Cancelar</Button>
        <Button variant="brand" className="flex-1" onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <span className="animate-spin inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {submitting ? (rawFiles.length > 0 ? "Enviando arquivos..." : "Criando pedido...") : "Enviar Pedido"}
        </Button>
      </div>
    </div>
  );
}
