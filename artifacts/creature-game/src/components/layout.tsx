import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Backpack, PackageOpen, Store, User as UserIcon, Coins, Swords } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetMe();

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-md mx-auto bg-background relative overflow-hidden shadow-2xl">
      {/* Background ambient light */}
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-30">
        <div className="w-[120%] h-[120%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background/0 to-transparent blur-3xl"></div>
      </div>

      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-md border-b border-white/5">
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-primary">Creature</span>Forge
        </h1>
        <div className="flex items-center gap-1.5 bg-background/80 rounded-full px-3 py-1.5 border border-white/5">
          <Coins className="w-4 h-4 text-legendary" />
          {isLoading ? (
            <Skeleton className="w-8 h-4" />
          ) : (
            <span className="font-mono text-sm font-bold text-legendary-glow">{user?.coins ?? 0}</span>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24 z-10">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-white/5 pb-safe max-w-md mx-auto">
        <div className="flex justify-around items-center h-16 px-1">
          <NavItem href="/inventory" icon={Backpack} label="Inventory" active={location === "/inventory" || location === "/"} />
          <NavItem href="/packs" icon={PackageOpen} label="Packs" active={location === "/packs"} />
          <NavItem href="/battle" icon={Swords} label="Battle" active={location === "/battle"} />
          <NavItem href="/marketplace" icon={Store} label="Market" active={location === "/marketplace"} />
          <NavItem href="/profile" icon={UserIcon} label="Profile" active={location === "/profile"} />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ href, icon: Icon, label, active }: { href: string; icon: any; label: string; active: boolean }) {
  return (
    <Link href={href} className="flex-1 flex flex-col items-center justify-center gap-1 h-full relative group">
      <div className={cn(
        "flex flex-col items-center justify-center w-full h-full transition-colors duration-200",
        active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
      )}>
        <Icon className={cn("w-4 h-4 transition-transform duration-200", active && "scale-110")} />
        <span className="text-[9px] font-medium mt-1">{label}</span>
      </div>
      {active && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-b-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
      )}
    </Link>
  );
}
