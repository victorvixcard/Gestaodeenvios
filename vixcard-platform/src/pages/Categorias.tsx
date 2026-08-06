import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Tags, Pencil, Power, PowerOff, Trash2, Package, Info } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { cn } from "../lib/utils";

interface Categoria {
  id: string;
  name: string;
  code: string;
  active: boolean;
  productsCount: number;
}

/**
 * Cadastro de categorias de produto.
 *
 * Antes a lista vivia fixa no código, em dois arquivos que precisavam ser
 * editados juntos. Agora vem do banco, e a sigla de 3 letras é o que forma
 * o código do produto (VIX-CAR-001).
 */
export function Categorias() {
  const [itens, setItens]     = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog]   = useState<"create" | "edit" | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState({ name: "", code: "" });
  const [saving, setSaving]   = useState(false);
  const [excluir, setExcluir] = useState<Categoria | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setItens(await api.get<Categoria[]>("/categories?all=1"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const abrirCriar = () => {
    setForm({ name: "", code: "" });
    setEditId(null);
    setDialog("create");
  };

  const abrirEditar = (c: Categoria) => {
    setForm({ name: c.name, code: c.code });
    setEditId(c.id);
    setDialog("edit");
  };

  const salvar = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome da categoria."); return; }
    if (form.code && !/^[A-Za-z]{3}$/.test(form.code)) {
      toast.error("A sigla deve ter exatamente 3 letras.");
      return;
    }
    setSaving(true);
    try {
      if (dialog === "create") {
        await api.post("/categories", { name: form.name.trim(), code: form.code || undefined });
        toast.success("Categoria criada.");
      } else if (editId) {
        await api.put(`/categories/${editId}`, { name: form.name.trim(), code: form.code });
        toast.success("Categoria atualizada.");
      }
      setDialog(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar categoria.");
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (c: Categoria) => {
    try {
      await api.patch(`/categories/${c.id}/toggle`, {});
      toast.success(c.active ? "Categoria desativada." : "Categoria ativada.");
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao alterar a categoria.");
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setSaving(true);
    try {
      await api.delete(`/categories/${excluir.id}`);
      toast.success(`Categoria "${excluir.name}" excluída.`);
      setExcluir(null);
      await carregar();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir categoria.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <Tags className="h-6 w-6 text-primary" />
            Categorias
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Agrupam os produtos e formam o código deles.
          </p>
        </div>
        <Button variant="brand" onClick={abrirCriar}>
          <Plus className="h-4 w-4" />
          Nova Categoria
        </Button>
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          A <strong className="text-foreground">sigla de 3 letras</strong> entra no código dos produtos —
          Cartões usa CAR e gera <span className="font-mono">VIX-CAR-001</span>. Categoria com produtos
          não pode ser excluída; desative-a para tirar do formulário sem mexer no que já existe.
        </p>
      </Card>

      {loading ? (
        <div className="flex justify-center py-14">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : itens.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-card">
          <Tags className="h-9 w-9 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Nenhuma categoria cadastrada.</p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {itens.map((c, i) => (
            <motion.div key={c.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card className={cn("p-4 bg-gradient-card h-full flex flex-col", !c.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    <span className="font-mono text-[11px] text-primary bg-primary/8 border border-primary/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {c.code}
                    </span>
                  </div>
                  {!c.active && <Badge variant="muted" className="text-[10px] flex-shrink-0">Inativa</Badge>}
                </div>

                <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                  <Package className="h-3 w-3" />
                  {c.productsCount === 0
                    ? "Nenhum produto"
                    : `${c.productsCount} produto${c.productsCount > 1 ? "s" : ""}`}
                </p>

                <div className="flex gap-1.5 mt-4 pt-3 border-t border-border/50">
                  <Button variant="outline" size="sm" className="flex-1 text-xs"
                          onClick={() => abrirEditar(c)}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                  <Button variant="ghost" size="sm"
                          className={cn("text-xs", c.active
                            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                            : "text-success hover:bg-success/10 hover:text-success")}
                          onClick={() => alternar(c)}>
                    {c.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  </Button>
                  {c.productsCount === 0 && (
                    <Button variant="ghost" size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setExcluir(c)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Nova Categoria" : "Editar Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Adesivos" value={form.name} autoFocus
                     onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Sigla</Label>
              <Input placeholder="Deixe em branco para gerar" maxLength={3}
                     value={form.code} className="w-28 uppercase font-mono"
                     onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} />
              <p className="text-[11px] text-muted-foreground">
                Três letras, usadas no código do produto. Em branco, o sistema sugere a partir do nome.
                {dialog === "edit" && " Alterar não muda o código dos produtos já cadastrados."}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : dialog === "create" ? "Criar Categoria" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir "{excluir?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Nenhum produto usa esta categoria, então a exclusão é segura. A ação não pode ser desfeita.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setExcluir(null)} disabled={saving}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={saving}>
              {saving ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
