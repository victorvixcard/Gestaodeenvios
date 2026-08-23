import type { User, UserRole } from "../types";

/**
 * Ações liberadas pelo papel — consolidação da lista antiga de
 * "permissões" por usuário. Espelha Role::ACOES / ACOES_PADRAO do backend,
 * que é quem de fato autoriza; aqui serve para mostrar/esconder botões.
 */
export type Acao = "criar_os" | "cancelar_os" | "gerenciar_usuarios" | "ver_relatorios";

export const ACOES: { key: Acao; label: string; hint: string }[] = [
  { key: "criar_os",           label: "Criar OS",            hint: "Abrir novas ordens de serviço" },
  { key: "cancelar_os",        label: "Cancelar OS",         hint: "Cancelar (na janela) ou solicitar cancelamento" },
  { key: "gerenciar_usuarios", label: "Gerenciar usuários",  hint: "Criar e editar usuários da própria empresa" },
  { key: "ver_relatorios",     label: "Ver relatórios",      hint: "Acessar a tela de Relatórios" },
];

export const ACOES_PADRAO: Record<UserRole, Acao[]> = {
  super_admin:  ["criar_os", "cancelar_os", "gerenciar_usuarios", "ver_relatorios"],
  tenant_admin: ["criar_os", "cancelar_os", "gerenciar_usuarios", "ver_relatorios"],
  operator:     ["criar_os", "cancelar_os"],
};

/** O usuário pode executar a ação? Super admin sempre pode. */
export function podeAcao(user: User | null | undefined, acao: Acao): boolean {
  if (!user) return false;
  if (user.role === "super_admin") return true;
  const acoes = user.papel?.acoes ?? ACOES_PADRAO[user.role] ?? [];
  return acoes.includes(acao);
}
