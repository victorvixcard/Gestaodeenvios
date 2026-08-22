import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, ShieldCheck, Pencil, Power, PowerOff, Trash2, Users as UsersIcon, Info, Check } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "../lib/api";
import { useData } from "../contexts/DataContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { cn } from "../lib/utils";
import type { Papel, MenuKey, UserRole } from "../types";

const NIVEIS: { value: UserRole; label: string; hint: string }[] = [
  { value: "super_admin",  label: "Super Admin",           hint: "Vê e gerencia todas as empresas" },
  { value: "tenant_admin", label: "Admin da Empresa",      hint: "Gerencia usuários e pedidos da própria empresa" },
  { value: "operator",     label: "Operador",              hint: "Cria e acompanha pedidos, sem cadastros" },
];

const MENUS: { key: MenuKey; label: string }[] = [
  { key: "dashboard",            label: "Dashboard" },
  { key: "pedidos",              label: "Pedidos" },
  { key: "kanban",               label: "Kanban" },
  { key: "relatorios",           label: "Relatórios" },
  { key: "cadastros.empresas",   label: "Cadastros: Empresas" },
  { key: "cadastros.produtos",   label: "Cadastros: Produtos" },
  { key: "cadastros.categorias", label: "Cadastros: Categorias" },
  { key: "cadastros.usuarios",   label: "Cadastros: Usuários" },
  { key: "cadastros.setores",    label: "Cadastros: Setores" },
  { key: "cadastros.papeis",     label: "Cadastros: Papéis" },
  { key: "logs",                 label: "Logs de Auditoria" },
];

const FORM_VAZIO = {
  name: "",
  baseRole: "operator" as UserRole,
  todosMenus: true,
  menus: [] as MenuKey[],
};

/**
 * Papéis dinâmicos. O nível de acesso (base) é quem manda na segurança do
 * backend; o papel dá nome próprio e escolhe quais menus aparecem. Um papel
 * nunca LIBERA além do nível — só esconde o que não interessa.
 */
export function Papeis() {
  const { papeis, users, reloadPapeis } = useData();
  const [dialog, setDialog]   = useState<"create" | "edit" | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm]       = useState(FORM_VAZIO);
  const [saving, setSaving]   = useState(false);
  const [excluir, setExcluir] = useState<Papel | null>(null);

  const abrirCriar = () => { setForm(FORM_VAZIO); setEditId(null); setDialog("create"); };

  const abrirEditar = (p: Papel) => {
    setForm({
      name: p.name,
      baseRole: p.baseRole,
      todosMenus: p.menus === null,
      menus: p.menus ?? [],
    });
    setEditId(p.id);
    setDialog("edit");
  };

  const toggleMenu = (key: MenuKey) => {
    setForm((f) => ({
      ...f,
      menus: f.menus.includes(key) ? f.menus.filter((m) => m !== key) : [...f.menus, key],
    }));
  };

  const salvar = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome do papel."); return; }
    if (!form.todosMenus && form.menus.length === 0) {
      toast.error("Marque ao menos um menu, ou deixe em 'Todos os menus'.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      base_role: form.baseRole,
      menus: form.todosMenus ? null : form.menus,
    };
    try {
      if (dialog === "create") {
        await api.post("/roles", payload);
        toast.success("Papel criado.");
      } else if (editId) {
        await api.put(`/roles/${editId}`, payload);
        toast.success("Papel atualizado.");
      }
      setDialog(null);
      await reloadPapeis();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar papel.");
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (p: Papel) => {
    try {
      await api.patch(`/roles/${p.id}/toggle`, {});
      toast.success(p.active ? "Papel desativado." : "Papel ativado.");
      await reloadPapeis();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao alterar o papel.");
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setSaving(true);
    try {
      await api.delete(`/roles/${excluir.id}`);
      toast.success(`Papel "${excluir.name}" excluído.`);
      setExcluir(null);
      await reloadPapeis();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir papel.");
    } finally {
      setSaving(false);
    }
  };

  const quantosUsam = (id: string) => users.filter((u) => u.papel?.id === id).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Papéis
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Definem o que cada tipo de usuário enxerga no sistema.
          </p>
        </div>
        <Button variant="brand" onClick={abrirCriar}>
          <Plus className="h-4 w-4" />
          Novo Papel
        </Button>
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Todo papel herda de um <strong className="text-foreground">nível de acesso</strong> (Super
          Admin, Admin da Empresa ou Operador) — é o nível que garante a segurança e o isolamento
          entre empresas. O papel personaliza o nome e <strong className="text-foreground">esconde
          menus</strong> que não interessam àquela função. Ele nunca libera além do nível.
        </p>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {papeis.map((p, i) => {
          const nivel = NIVEIS.find((n) => n.value === p.baseRole);
          const emUso = quantosUsam(p.id);
          return (
            <motion.div key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card className={cn("p-4 bg-gradient-card h-full flex flex-col", !p.active && "opacity-60")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{p.name}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{nivel?.label}</Badge>
                  </div>
                  {!p.active && <Badge variant="muted" className="text-[10px] flex-shrink-0">Inativo</Badge>}
                </div>

                <div className="text-[11px] text-muted-foreground mt-3 flex-1 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <UsersIcon className="h-3 w-3" />
                    {emUso === 0 ? "Nenhum usuário" : `${emUso} usuário${emUso > 1 ? "s" : ""}`}
                  </p>
                  <p className="text-muted-foreground/80">
                    {p.menus === null
                      ? "Todos os menus do nível"
                      : `${p.menus.length} menu${p.menus.length > 1 ? "s" : ""} visíve${p.menus.length > 1 ? "is" : "l"}`}
                  </p>
                </div>

                <div className="flex gap-1.5 mt-4 pt-3 border-t border-border/50">
                  <Button variant="outline" size="sm" className="flex-1 text-xs"
                          onClick={() => abrirEditar(p)}>
                    <Pencil className="h-3 w-3" />Editar
                  </Button>
                  <Button variant="ghost" size="sm"
                          className={cn("text-xs", p.active
                            ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                            : "text-success hover:bg-success/10 hover:text-success")}
                          onClick={() => alternar(p)}>
                    {p.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  </Button>
                  {p.usersCount === 0 && (
                    <Button variant="ghost" size="sm"
                            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setExcluir(p)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Novo Papel" : "Editar Papel"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input placeholder="Ex: Analista" value={form.name} autoFocus
                     onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>

            <div className="space-y-1.5">
              <Label>Nível de acesso</Label>
              <Select value={form.baseRole}
                      onValueChange={(v) => setForm((f) => ({ ...f, baseRole: v as UserRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEIS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {NIVEIS.find((n) => n.value === form.baseRole)?.hint}. É o nível que define
                o que o backend autoriza — o papel só ajusta a navegação.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Menus visíveis</Label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, todosMenus: !f.todosMenus }))}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border",
                  form.todosMenus ? "bg-primary/8 border-primary/30" : "border-border hover:bg-muted/60"
                )}
              >
                <div className={cn(
                  "h-4 w-4 rounded flex items-center justify-center flex-shrink-0 border-2",
                  form.todosMenus ? "bg-primary border-primary" : "border-border"
                )}>
                  {form.todosMenus && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <div>
                  <p className="text-xs font-medium">Todos os menus do nível</p>
                  <p className="text-[10px] text-muted-foreground">
                    Sem restrição extra — mostra tudo que o nível de acesso já permite
                  </p>
                </div>
              </button>

              {!form.todosMenus && (
                <div className="grid grid-cols-2 gap-1.5">
                  {MENUS.map((m) => {
                    const marcado = form.menus.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => toggleMenu(m.key)}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all border",
                          marcado ? "bg-primary/8 border-primary/30" : "border-border hover:bg-muted/60"
                        )}
                      >
                        <div className={cn(
                          "h-3.5 w-3.5 rounded flex items-center justify-center flex-shrink-0 border-2",
                          marcado ? "bg-primary border-primary" : "border-border"
                        )}>
                          {marcado && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        <span className="text-xs">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : dialog === "create" ? "Criar Papel" : "Salvar"}
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
            Nenhum usuário tem este papel, então a exclusão é segura. A ação não pode ser desfeita.
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
