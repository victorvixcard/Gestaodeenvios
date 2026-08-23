export type UserRole = "super_admin" | "tenant_admin" | "operator";

export type Permission =
  | "view_dashboard"
  | "view_orders"
  | "create_orders"
  | "manage_orders"
  | "view_products"
  | "view_reports"
  | "manage_users";

export type OrderStatus =
  | "pending"
  | "started"
  | "production"
  | "finishing"
  | "shipped"
  | "done"
  | "cancelled";

/** Fase canônica de produção — dá coluna no Kanban, cor e regra de atraso. */
export type Fase = Exclude<OrderStatus, "cancelled">;

/**
 * Uma etapa da linha do tempo. `key` identifica a etapa dentro do fluxo (é o
 * que Order.status guarda); `label` é o nome exibido; `fase` ancora a etapa
 * numa das 6 fases canônicas. Etapas padrão têm key igual ao nome da fase.
 */
export interface TimelineStep {
  key: string;
  label: string;
  fase: Fase;
}

export interface Tenant {
  slug: string;
  name: string;
  logoColor: string;
  logoInitials: string;
  logoUrl?: string;
}

export interface Sector {
  id: string;
  name: string;
  active: boolean;
  usersCount: number;
}

/** Chaves de menu que um papel pode liberar/esconder. */
export type MenuKey =
  | "dashboard" | "pedidos" | "kanban" | "relatorios" | "movimentacoes"
  | "cadastros.empresas" | "cadastros.produtos" | "cadastros.categorias"
  | "cadastros.usuarios" | "cadastros.setores" | "cadastros.papeis"
  | "logs";

/**
 * Papel dinâmico. O baseRole é o nível de acesso real (quem autoriza no
 * backend); menus restringe o que aparece na navegação — null = tudo que o
 * nível já permite.
 */
export type AcaoKey = "criar_os" | "cancelar_os" | "gerenciar_usuarios" | "ver_relatorios";

export interface Papel {
  id: string;
  name: string;
  baseRole: UserRole;
  menus: MenuKey[] | null;
  /** Acoes liberadas; null = padrao do nivel. */
  acoes: AcaoKey[] | null;
  active: boolean;
  usersCount: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  tenantSlug: string;
  avatarInitials: string;
  avatarUrl?: string;
  active: boolean;
  permissions: Permission[];
  /** Telefone/WhatsApp para contato e envio de credenciais. */
  whatsapp?: string;
  /** Um usuário pode estar em mais de um setor. */
  sectors: { id: string; name: string }[];
  /** Papel dinâmico (nome exibido + menus visíveis). */
  papel?: { id: string; name: string; baseRole: UserRole; menus: MenuKey[] | null; acoes: AcaoKey[] | null };
}

export interface VariationOption {
  id: string;
  label: string;
  requiresText?: boolean;
  textPlaceholder?: string;
}

export interface ProductVariation {
  id: string;
  name: string;
  required: boolean;
  options: VariationOption[];
}

export interface SelectedVariation {
  variationId: string;
  variationName: string;
  optionId: string;
  optionLabel: string;
  extraText?: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  imageUrl?: string;
  videoUrl?: string;
  price?: number;
  stock: number;
  active: boolean;
  variations?: ProductVariation[];
}

export interface Company {
  slug: string;
  name: string;
  logoColor: string;
  logoInitials: string;
  logoUrl?: string;
  active: boolean;
  allowedProductIds: string[];
  /** Colaboradores da VIXCard que atendem esta empresa. */
  attendantIds: string[];
  /** Fluxo de etapas da empresa; null = fluxo padrao. */
  timeline: TimelineStep[] | null;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  specifications: string;
  selectedVariations?: SelectedVariation[];
  /**
   * Prazo do item, calculado pelo backend com o prazo negociado entre a empresa
   * e o produto e congelado na criação do pedido. A tela apenas exibe — nunca
   * recalcula, senão volta a divergir do que está gravado no banco.
   */
  deadline?: string;
  deadlineDays?: number;
  isOverdue?: boolean;
  overdueDays?: number;
  /** Preço unitário congelado na criação do pedido. */
  unitPrice?: number;
  lineTotal?: number;
}

/** Prazo de entrega de um produto dentro de uma empresa. */
export interface ProductDeadline {
  id: string;
  code: string;
  name: string;
  category: string;
  active: boolean;
  deadlineDays: number | null;
}

export interface OrderNote {
  id: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  createdAt: string;
}

export interface OrderEvent {
  id: string;
  type: "status_change" | "note" | "file_upload" | "created" | "cancel";
  description: string;
  authorName: string;
  /** Chave da etapa (pode ser personalizada) ou "cancelled". */
  status?: string;
  createdAt: string;
}

export interface OrderFile {
  name: string;
  size: number;
  type: string;
  url: string; // object URL para download
}

/** Solicitação de cancelamento feita pela empresa cliente após a janela de 15 min. */
export interface CancelRequest {
  id: string;
  orderId: string;
  tenantSlug: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  requestedBy: string;
  createdAt: string;
  decidedBy?: string | null;
  decisionReason?: string | null;
  decidedAt?: string | null;
  /** Presentes só na listagem da fila. */
  orderTitle?: string;
  tenantName?: string;
}

export interface Order {
  id: string;
  tenantSlug: string;
  tenantName: string;
  title: string;
  /** Chave da etapa atual no fluxo do pedido (ou "cancelled"). */
  status: string;
  /** Fase canônica resolvida pelo backend — use para cores, colunas e filtros. */
  statusFase: OrderStatus;
  /** Rótulo exibido da etapa atual, resolvido pelo backend. */
  statusLabel: string;
  /** Fluxo congelado na criacao; null = padrao. */
  timeline?: TimelineStep[] | null;
  items: OrderItem[];
  notes: OrderNote[];
  events: OrderEvent[];
  cancelReason?: string;
  /** Solicitação de cancelamento mais recente, se houver. */
  cancelRequest?: CancelRequest | null;
  /** Empresa cliente ainda pode cancelar direto (janela de 15 min)? */
  canCancelDirectly: boolean;
  requestedBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  /** Preenchido quando a OS esta arquivada (soft delete). */
  archivedAt?: string | null;
  files?: OrderFile[];
}

// ── Creditos de produto (menu Movimentacoes) ────────────────────────────

export type MovimentacaoTipo = "entrada" | "saida" | "estorno";

export interface LoteCredito {
  id: number;
  productId: number;
  quantidade: number;
  restante: number;
  validade: string;          // yyyy-mm-dd
  motivo: string | null;
  /** Prazo vencido e relatorio, nunca desconto: o saldo nao muda. */
  vencido: boolean;
  createdAt: string | null;
}

export interface SaldoProduto {
  productId: number;
  productName: string;
  saldo: number;
  consumo30Dias: number;
  /** Unidades ainda em saldo cujo prazo de uso ja passou (so acompanhamento). */
  restanteVencido: number;
  lotesVencidos: LoteCredito[];
  proximoVencimento: { validade: string; restante: number } | null;
  lotes: LoteCredito[];
}

export interface Movimentacao {
  id: number;
  tenantSlug: string;
  productId: number;
  productName: string | null;
  tipo: MovimentacaoTipo;
  /** Como o lancamento nasceu: pela VIXCard (manual) ou por uma OS (automatico). */
  origem: "manual" | "automatico";
  quantidade: number;        // com sinal
  saldoAnterior: number;
  saldoPosterior: number;
  cobriuDescoberto: number;
  lotId: number | null;
  orderId: string | null;
  motivo: string | null;
  userName: string | null;
  createdAt: string | null;
}
