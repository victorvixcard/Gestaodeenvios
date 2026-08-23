import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { KanbanSquare, Timer, ShieldCheck, type LucideIcon } from "lucide-react";

/**
 * Casca das telas de login, no padrão do painel do Mundo do Saber: painel
 * de marca à esquerda (gradiente, selo, frase de efeito com destaque,
 * três benefícios) e formulário limpo à direita. No celular o painel
 * encolhe para um cabeçalho de marca acima do formulário.
 */
const BENEFICIOS: { Icon: LucideIcon; titulo: string; texto: string }[] = [
  { Icon: KanbanSquare, titulo: "Kanban em tempo real",
    texto: "Cada ordem de serviço visível da entrada à entrega, etapa por etapa." },
  { Icon: Timer, titulo: "Prazos por produto e por cliente",
    texto: "Alertas de atraso antes de virar problema, com a regra de cada empresa." },
  { Icon: ShieldCheck, titulo: "Histórico completo",
    texto: "Toda mudança fica registrada para acompanhamento e auditoria." },
];

export function LoginShell({ tile, brand, badge, headline, headlineAccent, description, gradient, children }: {
  /** Logo/iniciais, usado no painel e no cabeçalho mobile. */
  tile: ReactNode;
  /** Nome exibido ao lado do logo. */
  brand: string;
  /** Selo acima da frase (ex.: "Painel de ordens de serviço"). */
  badge: string;
  /** Primeira parte da frase de efeito. */
  headline: string;
  /** Parte destacada em cor de acento. */
  headlineAccent: string;
  description: string;
  /** CSS background do painel; sem ele usa o gradiente da marca. */
  gradient?: string;
  children: ReactNode;
}) {
  const fundo = gradient ?? "var(--gradient-hero)";

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* ── Painel de marca (desktop) ─────────────────────────────────── */}
      <aside
        className="relative hidden lg:flex lg:w-[52%] xl:w-[50%] flex-col justify-between p-10 xl:p-14 text-white overflow-hidden"
        style={{ background: fundo }}
      >
        {/* Pontilhado sutil, como no painel de referência */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        {/* Brilho no canto inferior direito, dá profundidade ao gradiente */}
        <div aria-hidden className="absolute -bottom-32 -right-32 h-[30rem] w-[30rem] rounded-full bg-accent/25 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}
          className="relative z-10 flex items-center gap-3"
        >
          {tile}
          <span className="font-display text-2xl font-extrabold tracking-tight leading-none">{brand}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
          className="relative z-10 max-w-md space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest">
            {badge}
          </span>

          <h2 className="font-display text-4xl xl:text-5xl font-extrabold leading-[1.08] tracking-tight">
            {headline}{" "}
            <span className="text-accent">{headlineAccent}</span>
          </h2>

          <p className="text-sm xl:text-base text-white/80 leading-relaxed">{description}</p>

          <ul className="space-y-4 pt-2">
            {BENEFICIOS.map(({ Icon, titulo, texto }, i) => (
              <motion.li
                key={titulo}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
                className="flex items-start gap-3"
              >
                <Icon className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">{titulo}</p>
                  <p className="text-xs text-white/75 leading-relaxed">{texto}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>

        <p className="relative z-10 text-[11px] text-white/60">
          VIXCard · Gestão de Envios · Vitória, ES
        </p>
      </aside>

      {/* ── Formulário ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Cabeçalho de marca só no celular */}
        <div className="lg:hidden flex items-center gap-3 p-5 text-white" style={{ background: fundo }}>
          {tile}
          <span className="font-display text-xl font-extrabold tracking-tight">{brand}</span>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.1 }}
            className="w-full max-w-[340px] space-y-6"
          >
            {children}
          </motion.div>
        </div>

        <p className="pb-6 text-center text-[11px] text-muted-foreground/70">
          Uso interno · Gestão de Envios © {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
