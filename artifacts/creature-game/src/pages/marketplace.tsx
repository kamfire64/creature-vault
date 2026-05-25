import { useState, useMemo } from "react";
import { Layout } from "@/components/layout";
import { CreatureCard } from "@/components/creature-card";
import {
  useListMarketplace,
  useBuyListing,
  useCancelListing,
  useGetMe,
  getListMarketplaceQueryKey,
  getGetMeQueryKey,
  getGetInventoryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Coins, Store, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES = ["Fire", "Water", "Nature", "Electric", "Stone", "Shadow", "Light"] as const;
const RARITIES = ["Common", "Rare", "Epic", "Legendary"] as const;
const TYPE_EMOJI: Record<string, string> = {
  Fire: "🔥", Water: "💧", Nature: "🌿", Electric: "⚡", Stone: "🪨", Shadow: "🌑", Light: "✨",
};

type SortKey = "price-asc" | "price-desc" | "power-desc" | "power-asc";

export default function MarketplacePage() {
  const { data: listings, isLoading } = useListMarketplace();
  const { data: me } = useGetMe();
  const buyListing = useBuyListing();
  const cancelListing = useCancelListing();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterRarity, setFilterRarity] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("price-asc");
  const [showFilters, setShowFilters] = useState(false);

  const handleBuy = (id: number) => {
    buyListing.mutate(
      { listingId: id },
      {
        onSuccess: () => {
          toast({ title: "Purchase successful! 🎉" });
          queryClient.invalidateQueries({ queryKey: getListMarketplaceQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Purchase failed", description: err.data?.error || "Insufficient coins", variant: "destructive" });
        },
      }
    );
  };

  const handleCancel = (id: number) => {
    cancelListing.mutate(
      { listingId: id },
      {
        onSuccess: () => {
          toast({ title: "Listing cancelled" });
          queryClient.invalidateQueries({ queryKey: getListMarketplaceQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Cancel failed", description: err.data?.error || "Unknown error", variant: "destructive" });
        },
      }
    );
  };

  const myListings = listings?.filter((l) => l.sellerUsername === me?.username) || [];
  const otherListings = listings?.filter((l) => l.sellerUsername !== me?.username) || [];

  const filteredAndSorted = useMemo(() => {
    let result = [...otherListings];
    if (filterType) result = result.filter((l) => l.creature.type === filterType);
    if (filterRarity) result = result.filter((l) => l.creature.rarity === filterRarity);
    result.sort((a, b) => {
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "price-desc") return b.price - a.price;
      if (sort === "power-desc") return b.creature.powerScore - a.creature.powerScore;
      return a.creature.powerScore - b.creature.powerScore;
    });
    return result;
  }, [otherListings, filterType, filterRarity, sort]);

  const sortLabel: Record<SortKey, string> = {
    "price-asc": "Price ↑",
    "price-desc": "Price ↓",
    "power-desc": "Power ↓",
    "power-asc": "Power ↑",
  };
  const sortKeys: SortKey[] = ["price-asc", "price-desc", "power-desc", "power-asc"];

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <Tabs defaultValue="browse" className="w-full">
          <TabsList className="w-full mb-2 bg-card/50">
            <TabsTrigger value="browse" className="flex-1 gap-1.5">
              Browse
              {!isLoading && otherListings.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold">{otherListings.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mine" className="flex-1 gap-1.5">
              My Listings
              {myListings.length > 0 && (
                <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 font-bold">{myListings.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── BROWSE ── */}
          <TabsContent value="browse" className="space-y-3">
            {/* Filter bar toggle */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                className={cn("gap-1.5 h-8 text-xs", showFilters && "border-primary text-primary bg-primary/10")}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="w-3 h-3" />
                Filters
                {(filterType || filterRarity) && (
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {[filterType, filterRarity].filter(Boolean).length}
                  </span>
                )}
              </Button>

              {/* Sort cycle */}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs text-muted-foreground"
                onClick={() => setSort((s) => sortKeys[(sortKeys.indexOf(s) + 1) % sortKeys.length])}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortLabel[sort]}
              </Button>
            </div>

            {showFilters && (
              <div className="space-y-2 p-3 bg-card/50 rounded-xl border border-white/5">
                {/* Type filter */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Type</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      className={cn("text-[10px] px-2 py-1 rounded-full border font-bold transition-all",
                        !filterType ? "bg-primary/20 text-primary border-primary/50" : "border-white/10 text-muted-foreground")}
                      onClick={() => setFilterType(null)}
                    >
                      All
                    </button>
                    {TYPES.map((t) => (
                      <button
                        key={t}
                        className={cn("text-[10px] px-2 py-1 rounded-full border font-bold transition-all",
                          filterType === t ? "bg-primary/20 text-primary border-primary/50" : "border-white/10 text-muted-foreground")}
                        onClick={() => setFilterType(filterType === t ? null : t)}
                      >
                        {TYPE_EMOJI[t]} {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rarity filter */}
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Rarity</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button
                      className={cn("text-[10px] px-2 py-1 rounded-full border font-bold transition-all",
                        !filterRarity ? "bg-primary/20 text-primary border-primary/50" : "border-white/10 text-muted-foreground")}
                      onClick={() => setFilterRarity(null)}
                    >
                      All
                    </button>
                    {RARITIES.map((r) => (
                      <button
                        key={r}
                        className={cn("text-[10px] px-2 py-1 rounded-full border font-bold transition-all",
                          filterRarity === r ? `bg-${r.toLowerCase()}/20 text-${r.toLowerCase()} border-${r.toLowerCase()}/50` : "border-white/10 text-muted-foreground")}
                        onClick={() => setFilterRarity(filterRarity === r ? null : r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {(filterType || filterRarity) && (
                  <button
                    className="text-[10px] text-muted-foreground underline underline-offset-2"
                    onClick={() => { setFilterType(null); setFilterRarity(null); }}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Results count */}
            {!isLoading && filteredAndSorted.length !== otherListings.length && (
              <p className="text-xs text-muted-foreground font-medium">
                Showing {filteredAndSorted.length} of {otherListings.length} listings
              </p>
            )}

            {isLoading ? (
              <LoadingGrid />
            ) : filteredAndSorted.length === 0 ? (
              otherListings.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
                  <SlidersHorizontal className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No listings match these filters.</p>
                  <button
                    className="text-xs text-primary mt-2 underline underline-offset-2"
                    onClick={() => { setFilterType(null); setFilterRarity(null); }}
                  >
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filteredAndSorted.map((listing) => (
                  <CreatureCard
                    key={listing.id}
                    creature={listing.creature}
                    badge={
                      <div className="bg-background/80 backdrop-blur px-1.5 py-0.5 rounded text-[9px] text-muted-foreground border border-white/10 truncate max-w-[72px]">
                        {listing.sellerUsername}
                      </div>
                    }
                    footer={
                      <Button
                        size="sm"
                        className="w-full mt-2 h-9 font-bold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30"
                        onClick={() => handleBuy(listing.id)}
                        disabled={buyListing.isPending || listing.price > (me?.coins ?? 0)}
                      >
                        <Coins className="w-3 h-3 mr-1.5 text-legendary" />
                        {listing.price}
                        {listing.price > (me?.coins ?? 0) && (
                          <span className="ml-1 text-[9px] opacity-60">Low coins</span>
                        )}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── MY LISTINGS ── */}
          <TabsContent value="mine" className="space-y-4">
            {isLoading ? (
              <LoadingGrid />
            ) : myListings.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
                <Store className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No active listings. Select a creature from your inventory to sell!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {myListings.map((listing) => (
                  <CreatureCard
                    key={listing.id}
                    creature={listing.creature}
                    badge={
                      <div className="bg-legendary/20 text-legendary border border-legendary/40 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                        <Coins className="w-2.5 h-2.5" /> {listing.price}
                      </div>
                    }
                    footer={
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full mt-2 h-9"
                        onClick={() => handleCancel(listing.id)}
                        disabled={cancelListing.isPending}
                      >
                        {cancelListing.isPending ? "Cancelling…" : "Cancel Listing"}
                      </Button>
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
      <Store className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
      <h3 className="font-bold text-lg mb-1">Market is quiet</h3>
      <p className="text-sm text-muted-foreground">No listings yet. List a creature from your inventory!</p>
    </div>
  );
}
