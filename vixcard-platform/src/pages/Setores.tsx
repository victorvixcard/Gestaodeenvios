import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Network, Pencil, Power, PowerOff, Trash2, Users as UsersIcon, Info } from "lucide-react";
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
import { cn } from "../lib/utils";
import type { Sector } from "../types";

/**
 * Cadastro de setores da equipe (Comercial, Produção, Linha de impressão,
 * Designer...). Os setores agrupam os colaboradores no painel lateral de
 * Pedidos e Kanban — é por eles que as demandas são organizadas.
 */
export function Setores() {
  const { sectors, users, reloadSectors } = useData();
  const [dialog, setDialog]   = useState<"create" | "edit" | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [nome, setNome]       = useState("");
  const [saving, setSaving]   = useState(false);
  const [excluir, setExcluir] = useState<Sector | null>(null);

  const abrirCriar = () => { setNome(""); setEditId(null); setDialog("create"); };
  const abrirEditar = (s: Sector) => { setNome(s.name); setEditId(s.id); setDialog("edit"); };

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do setor."); return; }
    setSaving(true);
    try {
      if (dialog === "create") {
        await api.post("/sectors", { name: nome.trim() });
        toast.success("Setor criado.");
      } else if (editId) {
        await api.put(`/sectors/${editId}`, { name: nome.trim() });
        toast.success("Setor atualizado.");
      }
      setDialog(null);
      await reloadSectors();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao salvar setor.");
    } finally {
      setSaving(false);
    }
  };

  const alternar = async (s: Sector) => {
    try {
      await api.patch(`/sectors/${s.id}/toggle`, {});
      toast.success(s.active ? "Setor desativado." : "Setor ativado.");
      await reloadSectors();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao alterar o setor.");
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    setSaving(true);
    try {
      await api.delete(`/sectors/${excluir.id}`);
      toast.success(`Setor "${excluir.name}" excluído.`);
      setExcluir(null);
      await reloadSectors();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir setor.");
    } finally {
      setSaving(false);
    }
  };

  // Nomes dos usuários de cada setor, para o card dizer quem está onde
  const nomesDoSetor = (id: string) =>
    users.filter((u) => u.sectors.some((s) => s.id === id)).map((u) => u.name);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-semibold text-primary mb-1">Cadastros</p>
          <h1 className="font-display text-2xl font-extrabold flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" />
            Setores
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organizam a equipe e o direcionamento das demandas.
          </p>
        </div>
        <Button variant="brand" onClick={abrirCriar}>
          <Plus className="h-4 w-4" />
          Novo Setor
        </Button>
      </div>

      <Card className="p-3 bg-primary/5 border-primary/20 flex gap-2.5 items-start">
        <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vincule os colaboradores aos setores no <strong className="text-foreground">cadastro de
          usuário</strong> — cada pessoa pode estar em mais de um setor. Nos Pedidos e no Kanban,
          o painel de colaboradores agrupa por setor. Setor com usuários não pode ser excluído;
          desative-o para tirar de circulação.
        </p>
      </Card>

      {sectors.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-card">
          <Network className="h-9 w-9 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">Nenhum setor cadastrado.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie setores como Comercial, Produção, Linha de impressão e Designer.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectors.map((s, i) => {
            const nomes = nomesDoSetor(s.id);
            return (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card className={cn("p-4 bg-gradient-card h-full flex flex-col", !s.active && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{s.name}</p>
                    {!s.active && <Badge variant="muted" className="text-[10px] flex-shrink-0">Inativo</Badge>}
                  </div>

                  <div className="text-[11px] text-muted-foreground mt-2 flex-1">
                    <p className="flex items-center gap-1.5">
                      <UsersIcon className="h-3 w-3" />
                      {nomes.length === 0
                        ? "Nenhum colaborador"
                        : `${nomes.length} colaborador${nomes.length > 1 ? "es" : ""}`}
                    </p>
                    {nomes.length > 0 && (
                      <p className="mt-1 leading-relaxed text-muted-foreground/80 line-clamp-2">
                        {nomes.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1.5 mt-4 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm" className="flex-1 text-xs"
                            onClick={() => abrirEditar(s)}>
                      <Pencil className="h-3 w-3" />Editar
                    </Button>
                    <Button variant="ghost" size="sm"
                            className={cn("text-xs", s.active
                              ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                              : "text-success hover:bg-success/10 hover:text-success")}
                            onClick={() => alternar(s)}>
                      {s.active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                    </Button>
                    {s.usersCount === 0 && (
                      <Button variant="ghost" size="sm"
                              className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setExcluir(s)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={!!dialog} onOpenChange={(v) => !v && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog === "create" ? "Novo Setor" : "Editar Setor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Nome *</Label>
            <Input placeholder="Ex: Linha de impressão" value={nome} autoFocus
                   onChange={(e) => setNome(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && salvar()} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={saving}>Cancelar</Button>
            <Button variant="brand" onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : dialog === "create" ? "Criar Setor" : "Salvar"}
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
            Nenhum colaborador está neste setor, então a exclusão é segura. A ação não pode ser desfeita.
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
