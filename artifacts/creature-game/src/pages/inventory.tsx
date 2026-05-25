import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { CreatureCard } from "@/components/creature-card";
import {
  useGetInventory,
  useGetInventoryStats,
  useCreateListing,
  getGetInventoryQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Coins, Swords, ShieldAlert, Shield, Heart, Zap, Sword, SlidersHorizontal, ArrowUpDown
} from "lucide-react";
import { PixelCreature } from "@/components/pixel-creature";
import { cn } from "@/lib/utils";
import { normalizeCreatureList } from "@/lib/normalize-creature-list";

const TYPES = ["Fire", "Water", "Nature", "Electric", "Stone", "Shadow", "Light"] as const;
const RARITIES = ["Common", "Rare", "Epic", "Legendary"] as const;
const TYPE_EMOJI: Record<string, string> = {
  Fire: "🔥", Water: "💧", Nature: "🌿", Electric: "⚡", Stone: "🪨", Shadow: "🌑", Light: "✨",
};
const TYPE_COLORS: Record<string, string> = {
  Fire: "text-red-400 border-red-500/40 bg-red-500/10",
  Water: "text-blue-400 border-blue-500/40 bg-blue-500/10",
  Nature: "text-green-400 border-green-500/40 bg-green-500/10",
  Electric: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  Stone: "text-stone-400 border-stone-500/40 bg-stone-500/10",
  Shadow: "text-purple-400 border-purple-500/40 bg-purple-500/10",
  Light: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
};

type SortKey = "power-desc" | "power-asc" | "name-asc" | "xp-desc";

export default function InventoryPage() {
  const { data: inventoryData, isLoading } = useGetInventory();
  const creatures = useMemo(
    () => normalizeCreatureList(inventoryData),
    [inventoryData],
  );
  const { data: stats } = useGetInventoryStats();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sellPrice, setSellPrice] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createListing = useCreateListing();

  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("power-desc");
  const [showFilters, setShowFilters] = useState(false);

  const sortLabel: Record<SortKey, string> = {
    "power-desc": "Power ↓", "power-asc": "Power ↑", "name-asc": "Name A–Z", "xp-desc": "XP ↓",
  };
  const sortKeys: SortKey[] = ["power-desc", "power-asc", "name-asc", "xp-desc"];

  const filtered = useMemo(() => {
    let result = [...creatures];
    if (filterType) result = result.filter((c) => c.type === filterType);
    if (filterRarity) result = result.filter((c) => c.rarity === filterRarity);
    result.sort((a, b) => {
      if (sort === "power-desc") return b.powerScore - a.powerScore;
      if (sort === "power-asc") return a.powerScore - b.powerScore;
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "xp-desc") return b.xp - a.xp;
      return 0;
    });
    return result;
  }, [creatures, filterType, filterRarity, sort]);

  const selectedCreature = creatures.find((c) => c.id === selectedId);

  const handleSell = () => {
    if (!selectedId || !sellPrice) return;
    const price = parseInt(sellPrice, 10);
    if (isNaN(price) || price <= 0) {
      toast({ title: "Invalid price", variant: "destructive" });
      return;
    }
    createListing.mutate(
      { data: { ownedCreatureId: selectedId, price } },
      {
        onSuccess: () => {
          toast({ title: "Creature listed! 💰" });
          setSelectedId(null);
          setSellPrice("");
          queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Failed to list", description: err.data?.error || "Unknown error", variant: "destructive" });
        },
      }
    );
  };

  return (
    <Layout>
      <div className="p-4 space-y-4">
        {/* Stats banner */}
        {stats && (
          <div className="bg-card border border-white/5 rounded-2xl p-4 shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Collection Stats</h2>
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-1 rounded-md">
                <Swords className="w-3.5 h-3.5" />
                <span className="font-mono font-bold text-sm">{stats.totalPower}</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
            <StatBadge label="C" count={stats.byRarity?.Common ?? 0} color="common" />
            <StatBadge label="R" count={stats.byRarity?.Rare ?? 0} color="rare" />
            <StatBadge label="E" count={stats.byRarity?.Epic ?? 0} color="epic" />
            <StatBadge label="L" count={stats.byRarity?.Legendary ?? 0} color="legendary" />
            </div>
          </div>
        )}

        {/* Header + filter controls */}
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold shrink-0">
            Your Creatures
            {filtered.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length})</span>
            )}
          </h2>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn("w-8 h-8", showFilters && "text-primary")}
              onClick={() => setShowFilters((v) => !v)}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground"
              onClick={() => setSort((s) => sortKeys[(sortKeys.indexOf(s) + 1) % sortKeys.length])}
              title={sortLabel[sort]}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="space-y-2.5 p-3 bg-card/50 rounded-xl border border-white/5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Type</p>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip active={!filterType} onClick={() => setFilterType(null)}>All</FilterChip>
                {TYPES.map((t) => (
                  <FilterChip key={t} active={filterType === t} onClick={() => setFilterType(filterType === t ? null : t)}>
                    {TYPE_EMOJI[t]} {t}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Rarity</p>
              <div className="flex gap-1.5 flex-wrap">
                <FilterChip active={!filterRarity} onClick={() => setFilterRarity(null)}>All</FilterChip>
                {RARITIES.map((r) => (
                  <FilterChip key={r} active={filterRarity === r} onClick={() => setFilterRarity(filterRarity === r ? null : r)}>
                    {r}
                  </FilterChip>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sort</p>
              <div className="flex gap-1.5 flex-wrap">
                {sortKeys.map((k) => (
                  <FilterChip key={k} active={sort === k} onClick={() => setSort(k)}>{sortLabel[k]}</FilterChip>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-xl" />)}
          </div>
        ) : creatures.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
            <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg mb-1">Collection Empty</h3>
            <p className="text-sm text-muted-foreground">Head to Packs to summon your first creatures!</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
            <SlidersHorizontal className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No creatures match these filters.</p>
            <button
              className="text-xs text-primary mt-2 underline underline-offset-2"
              onClick={() => { setFilterType(null); setFilterRarity(null); }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((c, i) => (
              <CreatureCard
                key={c.id}
                creature={c}
                delayMs={i * 40}
                className="animate-in fade-in slide-in-from-bottom-4"
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Creature detail sheet */}
      <Sheet open={!!selectedCreature} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90dvh] overflow-y-auto bg-card border-white/10">
          {selectedCreature && (
            <div className="space-y-5 pb-safe">
              {/* Header: sprite + name */}
              <SheetHeader className="text-left">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-24 h-24 rounded-2xl flex items-center justify-center border shrink-0",
                    `bg-${selectedCreature.rarity.toLowerCase()}/20 border-${selectedCreature.rarity.toLowerCase()}/30`
                  )}>
                    <PixelCreature
                      name={selectedCreature.name}
                      rarity={selectedCreature.rarity}
                      type={selectedCreature.type}
                      size={80}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <SheetTitle className="text-2xl font-black leading-tight">{selectedCreature.name}</SheetTitle>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-bold border-current bg-background/50", `text-${selectedCreature.rarity.toLowerCase()}`)}
                      >
                        {selectedCreature.rarity}
                      </Badge>
                      <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", TYPE_COLORS[selectedCreature.type] || TYPE_COLORS.Fire)}>
                        {TYPE_EMOJI[selectedCreature.type]} {selectedCreature.type}
                      </span>
                    </div>
                    {/* XP bar */}
                    <div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5 font-mono">
                        <span>XP</span>
                        <span>{selectedCreature.xp}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full transition-all"
                          style={{ width: `${Math.min(100, (selectedCreature.xp % 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Stats */}
              <div className="bg-background/50 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground font-bold">Power Score</span>
                  <span className="text-2xl font-black text-primary">{selectedCreature.powerScore}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatBar icon={Sword} label="ATK" value={selectedCreature.attack} color="hsl(var(--destructive))" />
                  <StatBar icon={Shield} label="DEF" value={selectedCreature.defense} color="hsl(var(--primary))" />
                  <StatBar icon={Heart} label="HP" value={selectedCreature.health} color="#22c55e" />
                  <StatBar icon={Zap} label="SPD" value={selectedCreature.speed} color="#f59e0b" />
                </div>
              </div>

              {/* Sell / status */}
              <div>
                {selectedCreature.listedForSale ? (
                  <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl text-center">
                    <p className="font-bold text-primary">Currently Listed for Sale</p>
                    <p className="text-xs text-muted-foreground mt-1">Visit My Listings in the Marketplace to cancel.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-sm font-bold">Sell on Marketplace</Label>
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-legendary" />
                        <Input
                          type="number"
                          min="1"
                          className="pl-9 font-mono"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          placeholder="Set price"
                        />
                      </div>
                      <Button onClick={handleSell} disabled={createListing.isPending || !sellPrice} className="shrink-0">
                        {createListing.isPending ? "Listing…" : "List"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Layout>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        "text-[10px] px-2 py-1 rounded-full border font-bold transition-all",
        active ? "bg-primary/20 text-primary border-primary/50" : "border-white/10 text-muted-foreground hover:border-white/20"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-lg bg-background border border-${color}/20`}>
      <span className={`text-[10px] font-bold text-${color}`}>{label}</span>
      <span className="font-mono font-bold mt-0.5 text-sm">{count}</span>
    </div>
  );
}

function StatBar({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / 150) * 100));
  return (
    <div>
      <div className="flex justify-between items-center text-xs mb-1">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </div>
        <span className="font-mono font-bold">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
