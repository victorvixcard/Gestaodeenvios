import { Menu, Sun, Moon, User as UserIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { NotificationsPanel } from "../shared/NotificationsPanel";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { cn } from "../../lib/utils";

interface TopbarProps {
  onMenuClick: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { user } = useAuth();
  const tenant = useTenant();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

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

        <NotificationsPanel />

        <button
          type="button"
          onClick={() => navigate(`/${tenant.slug}/perfil`)}
          className="flex items-center gap-2 ml-1 rounded-lg hover:bg-muted px-1.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Abrir perfil"
        >
          <div className={cn(
            "h-8 w-8 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-primary text-white text-xs font-bold"
          )}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              : (user?.avatarInitials ?? <UserIcon className="h-4 w-4" />)}
          </div>
          <div className="hidden sm:block min-w-0 text-left">
            <p className="text-sm font-medium leading-none truncate max-w-[120px]">{user?.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[120px]">{tenant.name}</p>
          </div>
        </button>
      </div>
    </header>
  );
}
