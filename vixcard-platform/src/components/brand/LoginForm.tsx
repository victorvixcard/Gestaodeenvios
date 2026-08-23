import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});
type FormData = z.infer<typeof schema>;

/**
 * Formulário de login compartilhado. O erro aparece dentro do card, junto
 * dos campos — não some num toast no canto. O botão só habilita com os dois
 * campos preenchidos, e some o erro assim que o usuário volta a digitar.
 */
export function LoginForm({ onSubmit, emailPlaceholder = "seu@email.com.br", eyebrow = "Acesso restrito", subtitle = "Entre com suas credenciais para acessar o painel." }: {
  /** Devolve null no sucesso ou a mensagem de erro a exibir. */
  onSubmit: (data: FormData) => Promise<string | null>;
  emailPlaceholder?: string;
  /** Rotulo pequeno acima do titulo. */
  eyebrow?: string;
  subtitle?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const email = watch("email");
  const password = watch("password");
  const preenchido = email.trim().length > 0 && password.length > 0;

  const enviar = async (data: FormData) => {
    setErro(null);
    setLoading(true);
    try {
      const msg = await onSubmit(data);
      if (msg) setErro(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div>
        <p className="text-[11px] uppercase tracking-widest font-bold text-primary mb-2">{eyebrow}</p>
        <h2 className="font-display text-2xl font-extrabold tracking-tight">Bem-vindo(a) de volta!</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <form onSubmit={handleSubmit(enviar)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            placeholder={emailPlaceholder}
            autoComplete="email"
            autoFocus
            disabled={loading}
            aria-invalid={!!errors.email}
            {...register("email", { onChange: () => setErro(null) })}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              disabled={loading}
              aria-invalid={!!errors.password}
              {...register("password", { onChange: () => setErro(null) })}
              className={errors.password ? "border-destructive pr-10" : "pr-10"}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {erro && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {erro}
          </div>
        )}

        <Button type="submit" className="w-full gap-2 h-11 text-sm font-semibold" disabled={loading || !preenchido}>
          {loading ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Entrando...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              Entrar no painel
            </>
          )}
        </Button>
      </form>
    </>
  );
}
