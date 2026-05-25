import { useMemo } from "react";
import { Layout } from "@/components/layout";
import { useGetMe, useGetInventory, useGetInventoryStats } from "@workspace/api-client-react";
import { User, Coins, Swords, Award, Flame, Droplets, Leaf, Zap, Mountain, Moon, Sun } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PixelCreature } from "@/components/pixel-creature";
import { cn } from "@/lib/utils";
import { normalizeCreatureList } from "@/lib/normalize-creature-list";

const TYPE_ICONS: Record<string, React.ElementType> = {
  Fire: Flame, Water: Droplets, Nature: Leaf, Electric: Zap,
  Stone: Mountain, Shadow: Moon, Light: Sun,
};
const TYPE_COLORS: Record<string, string> = {
  Fire: "bg-red-500", Water: "bg-blue-500", Nature: "bg-green-500",
  Electric: "bg-amber-500", Stone: "bg-stone-500", Shadow: "bg-purple-500", Light: "bg-yellow-500",
};
const TYPE_TEXT: Record<string, string> = {
  Fire: "text-red-400", Water: "text-blue-400", Nature: "text-green-400",
  Electric: "text-amber-400", Stone: "text-stone-400", Shadow: "text-purple-400", Light: "text-yellow-400",
};

export default function ProfilePage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: stats, isLoading: statsLoading } = useGetInventoryStats();
  const { data: inventoryData } = useGetInventory();
  const creatures = useMemo(
    () => normalizeCreatureList(inventoryData),
    [inventoryData],
  );

  // Compute type distribution from inventory
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of creatures) {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return counts;
  }, [creatures]);

  const totalCreatures = stats?.total ?? 0;
  const typeEntries = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <Layout>
      <div className="p-4 space-y-5">

        {/* Profile hero */}
        <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-lg flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-28 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
          <div className="w-24 h-24 rounded-full bg-background border-4 border-card shadow-xl z-10 flex items-center justify-center">
            <User className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mt-4 z-10">
            {userLoading ? <Skeleton className="h-8 w-32 mx-auto" /> : user?.username ?? "Trainer"}
          </h2>
          <div className="flex items-center gap-2 mt-2 bg-background/50 px-4 py-1.5 rounded-full border border-white/5 z-10">
            <Coins className="w-4 h-4 text-legendary" />
            <span className="font-mono font-bold text-legendary-glow">
              {userLoading ? <Skeleton className="h-5 w-12 inline-block" /> : user?.coins ?? 0}
            </span>
          </div>
        </div>

        {/* Collection summary */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Collection</h3>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Creatures" icon={Swords} isLoading={statsLoading} value={stats?.total ?? 0} />
            <StatCard label="Total Power" icon={Award} isLoading={statsLoading} value={stats?.totalPower ?? 0} accent />
          </div>
        </div>

        {/* Strongest creature */}
        {stats?.strongestCreature && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Strongest Creature</h3>
            <div className={cn(
              "bg-card p-4 rounded-2xl border flex items-center gap-4",
              `border-${stats.strongestCreature.rarity?.toLowerCase()}/30`
            )}>
              {(() => {
                const sc = creatures.find(c => c.name === stats.strongestCreature?.name);
                return sc ? (
                  <div className={cn(
                    "w-16 h-16 rounded-xl flex items-center justify-center border shrink-0",
                    `bg-${sc.rarity.toLowerCase()}/20 border-${sc.rarity.toLowerCase()}/30`
                  )}>
                    <PixelCreature name={sc.name} rarity={sc.rarity} type={sc.type} size={52} />
                  </div>
                ) : null;
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg leading-tight truncate">{stats.strongestCreature.name}</p>
                <p className={cn("text-xs font-bold mt-0.5", `text-${stats.strongestCreature.rarity?.toLowerCase()}`)}>
                  {stats.strongestCreature.rarity}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Power</p>
                <p className="text-2xl font-mono font-black text-primary">{stats.strongestCreature.powerScore}</p>
              </div>
            </div>
          </div>
        )}

        {/* Type breakdown */}
        {typeEntries.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Type Distribution</h3>
            <div className="bg-card border border-white/5 rounded-2xl p-4 space-y-2.5">
              {typeEntries.map(([type, count]) => {
                const Icon = TYPE_ICONS[type] ?? Flame;
                const pct = totalCreatures > 0 ? Math.round((count / totalCreatures) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-3">
                    <Icon className={cn("w-3.5 h-3.5 shrink-0", TYPE_TEXT[type] ?? "text-muted-foreground")} />
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-xs font-bold w-14 truncate">{type}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700", TYPE_COLORS[type] ?? "bg-primary")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rarity breakdown */}
        {stats && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Rarity Breakdown</h3>
            <div className="grid grid-cols-4 gap-2">
              {(["Common", "Rare", "Epic", "Legendary"] as const).map((r) => (
                <div key={r} className={cn("flex flex-col items-center justify-center p-3 rounded-xl bg-background border", `border-${r.toLowerCase()}/20`)}>
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", `text-${r.toLowerCase()}`)}>{r[0]}</span>
                  <span className="font-mono font-black text-lg mt-0.5">{stats.byRarity[r]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}

function StatCard({ label, icon: Icon, isLoading, value, accent = false }: {
  label: string; icon: React.ElementType; isLoading: boolean; value: number; accent?: boolean;
}) {
  return (
    <div className="bg-card p-4 rounded-xl border border-white/5">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-4 h-4" />
        <p className="text-xs uppercase tracking-wider font-bold">{label}</p>
      </div>
      <div className={cn("text-2xl font-mono font-black", accent ? "text-primary" : "text-foreground")}>
        {isLoading ? <Skeleton className="h-8 w-16" /> : value.toLocaleString()}
      </div>
    </div>
  );
}
