import { Menu, Sun, Moon, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { Button } from "../ui/button";
import { AvatarUpload } from "../shared/AvatarUpload";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { user, updateAvatar, logout } = useAuth();
  const tenant = useTenant();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Mesmo fluxo do "Sair" da sidebar — aqui no topo fica sempre a vista,
  // mesmo com a sidebar recolhida no celular
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1 min-w-0">
        {title && (
          <h1 className="font-display text-base font-semibold truncate">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Alternar tema"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          title="Sair do sistema"
          aria-label="Sair do sistema"
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2 ml-1">
          <AvatarUpload
            size="sm"
            currentUrl={user?.avatarUrl}
            initials={user?.avatarInitials}
            color="#6366f1"
            title="Foto do perfil"
            hint="Use uma foto nítida com rosto centralizado."
            onSave={updateAvatar}
          />
          <div className="hidden sm:block min-w-0">
            <p className="text-sm font-medium leading-none truncate max-w-[120px]">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{tenant.name}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
