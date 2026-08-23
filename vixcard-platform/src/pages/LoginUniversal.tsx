import { useNavigate, useSearchParams } from "react-router-dom";
import { Send } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LoginShell } from "../components/brand/LoginShell";
import { LoginForm } from "../components/brand/LoginForm";

/**
 * Login universal (/login): sem empresa na URL — o backend descobre o
 * tenant pelo e-mail e a tela redireciona para o dashboard dele.
 */
export function LoginUniversal() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // api.ts manda para ca com ?expirado=1 quando o token venceu
  const expirado = params.get("expirado") === "1";

  return (
    <LoginShell
      tile={
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/25 backdrop-blur">
          <Send className="h-5 w-5 text-white" />
        </div>
      }
      brand="Gestão de Envios"
      badge="Painel de ordens de serviço"
      headline="Cada pedido acompanhado,"
      headlineAccent="nenhum prazo perdido."
      description="Gerencie as ordens de serviço gráficas: acompanhe etapas, prazos por produto e o envio ao cliente — tudo em um só lugar."
    >
      <LoginForm
        eyebrow="Acesso restrito"
        subtitle={expirado ? "Sua sessão expirou. Entre novamente para continuar." : "Entre com suas credenciais para acessar o painel."}
        onSubmit={async ({ email, password }) => {
          const result = await login(email, password);
          if (result.success && result.tenantSlug) {
            navigate(`/${result.tenantSlug}/dashboard`, { replace: true });
            return null;
          }
          return "E-mail ou senha incorretos.";
        }}
      />
    </LoginShell>
  );
}
