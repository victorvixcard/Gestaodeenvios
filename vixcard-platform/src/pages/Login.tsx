import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn, Layers } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});
type FormData = z.infer<typeof schema>;

export function Login() {
  const { login } = useAuth();
  const tenant = useTenant();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    const success = await login(data.email, data.password, tenant.slug);
    setLoading(false);
    if (success) {
      toast.success(`Bem-vindo, ${tenant.name}!`);
      navigate(`/${tenant.slug}/dashboard`);
    } else {
      toast.error("E-mail ou senha incorretos.");
    }
  };

  const isSuperAdmin = tenant.slug === "sistemalegado";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse at 30% 40%, ${tenant.logoColor}40 0%, transparent 60%),
                       radial-gradient(ellipse at 70% 70%, hsl(var(--accent) / 0.15) 0%, transparent 50%)`,
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-[400px] relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            className="inline-flex items-center justify-center h-16 w-16 rounded-2xl text-white text-xl font-bold mb-4 shadow-glow"
            style={{ background: tenant.logoColor }}
          >
            {tenant.logoInitials}
          </motion.div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin ? "Acesso administrativo da VIXCard" : "Portal do cliente — acesse sua conta"}
          </p>
        </div>

        <Card className="shadow-glow border-border/60">
          <div className="p-6 space-y-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={isSuperAdmin ? "admin@vixcard.com.br" : `admin@${tenant.slug}.com.br`}
                  autoComplete="email"
                  {...register("email")}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    {...register("password")}
                    className={errors.password ? "border-destructive pr-10" : "pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                variant={isSuperAdmin ? "brand" : "default"}
                disabled={loading}
              >
                {loading ? (
                  <span className="animate-spin inline-block h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            {/* Demo credentials hint */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground/60 text-center leading-relaxed">
                <strong className="text-muted-foreground/80">Demo:</strong>{" "}
                {isSuperAdmin ? "admin@vixcard.com.br" : `admin@${tenant.slug}.com.br`} / qualquer senha
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/50">
          <Layers className="h-3 w-3" />
          <span>VIXCard Gestão de Pedidos © 2025</span>
        </div>
      </motion.div>
    </div>
  );
}
