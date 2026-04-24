import { Menu, Bell, Sun, Moon } from "lucide-react";
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
  const { user, updateAvatar } = useAuth();
  const tenant = useTenant();
  const { theme, setTheme } = useTheme();

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

        <Button variant="ghost" size="icon-sm" aria-label="Notificações" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent" />
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
