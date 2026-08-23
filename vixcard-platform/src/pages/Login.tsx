import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { LoginShell } from "../components/brand/LoginShell";
import { LoginForm } from "../components/brand/LoginForm";

/**
 * Login por empresa (/{tenant}/login): mesma tela do login universal, com
 * a marca e a cor do tenant no painel. O slug da URL vai junto no login e
 * restringe a autenticação àquela empresa.
 */
export function Login() {
  const { login } = useAuth();
  const tenant = useTenant();
  const navigate = useNavigate();

  // Gradiente na cor da empresa: escurece para o fundo e clareia para a
  // borda, mesmo desenho do gradiente da marca
  const gradiente = `linear-gradient(135deg, color-mix(in srgb, ${tenant.logoColor} 70%, black) 0%, ${tenant.logoColor} 60%, color-mix(in srgb, ${tenant.logoColor} 70%, white) 100%)`;

  return (
    <LoginShell
      gradient={gradiente}
      tile={
        tenant.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name} className="h-11 w-11 rounded-xl object-cover bg-white" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/25 backdrop-blur text-white text-sm font-bold">
            {tenant.logoInitials}
          </div>
        )
      }
      brand={tenant.name}
      badge="Portal de pedidos"
      headline="Seus pedidos gráficos,"
      headlineAccent="do briefing à entrega."
      description={`Abra ordens de serviço, acompanhe cada etapa da produção e receba o material da ${tenant.name} no prazo combinado.`}
    >
      <LoginForm
        eyebrow={`Acesso ${tenant.name}`}
        emailPlaceholder={`voce@${tenant.slug}.com.br`}
        onSubmit={async ({ email, password }) => {
          const result = await login(email, password, tenant.slug);
          if (result.success) {
            toast.success(`Bem-vindo, ${tenant.name}!`);
            navigate(`/${tenant.slug}/dashboard`);
            return null;
          }
          return "E-mail ou senha incorretos.";
        }}
      />
    </LoginShell>
  );
}
