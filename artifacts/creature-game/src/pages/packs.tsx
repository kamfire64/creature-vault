import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { CreatureCard } from "@/components/creature-card";
import { useOpenPack, getGetMeQueryKey, getGetInventoryQueryKey, getGetInventoryStatsQueryKey, PackInputPackType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PackageOpen, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PacksPage() {
  const [opening, setOpening] = useState<PackInputPackType | null>(null);
  const [results, setResults] = useState<any[] | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showFlash, setShowFlash] = useState(false);
  
  const openPack = useOpenPack();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleOpen = (packType: PackInputPackType) => {
    setOpening(packType);
    setResults(null);
    setRevealedCount(0);
    setShowFlash(false);

    openPack.mutate(
      { data: { packType } },
      {
        onSuccess: (res) => {
          setTimeout(() => {
            setResults(res.creaturesReceived);
            setOpening(null);
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetInventoryStatsQueryKey() });
          }, 1500);
        },
        onError: (err) => {
          setOpening(null);
          toast({ title: "Failed to open pack", description: err.data?.error || "Unknown error", variant: "destructive" });
        }
      }
    );
  };

  useEffect(() => {
    if (!(results && revealedCount < results.length)) return;
    const timer = setTimeout(() => {
      const nextCreature = results[revealedCount];
      if (nextCreature.rarity === "Legendary") {
        setShowFlash(true);
        setTimeout(() => setShowFlash(false), 1500);
      }
      setRevealedCount(c => c + 1);
    }, 600);
    return () => clearTimeout(timer);
  }, [results, revealedCount]);

  return (
    <Layout>
      {showFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-legendary animate-screen-flash mix-blend-screen" />
      )}
      <div className="p-4 space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold">Summon Creatures</h2>
          <p className="text-muted-foreground text-sm mt-1">Open packs to expand your collection.</p>
        </div>

        {results ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-bold text-primary">Pack Opened!</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {results.map((c, i) => {
                const isRevealed = i < revealedCount;
                return (
                  <CreatureCard
                    key={c.id}
                    creature={c}
                    faceDown={!isRevealed}
                    className={cn(
                      !isRevealed ? "opacity-100 scale-100" : `reveal-${c.rarity.toLowerCase()}`
                    )}
                  />
                );
              })}
            </div>
            {revealedCount === results.length && (
              <Button className="w-full mt-4 animate-in fade-in" size="lg" onClick={() => setResults(null)}>
                Continue
              </Button>
            )}
          </div>
        ) : opening ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <div className="relative">
              <PackageOpen className={cn("w-24 h-24 animate-pack-shake", opening === PackInputPackType.legendary ? "text-legendary" : opening === PackInputPackType.premium ? "text-rare" : "text-common")} />
              <div className={cn("absolute inset-0 blur-2xl rounded-full animate-pulse", opening === PackInputPackType.legendary ? "bg-legendary/40" : opening === PackInputPackType.premium ? "bg-rare/40" : "bg-common/40")} />
            </div>
            <h3 className="text-lg font-bold animate-pulse text-primary">Unsealing Magic...</h3>
          </div>
        ) : (
          <div className="space-y-4">
            <PackCard
              title="Basic Pack"
              description="3 creatures. Mostly common."
              cost={50}
              type={PackInputPackType.basic}
              onBuy={() => handleOpen(PackInputPackType.basic)}
              color="common"
              disabled={openPack.isPending}
            />
            <PackCard
              title="Premium Pack"
              description="5 creatures. Guaranteed rare."
              cost={150}
              type={PackInputPackType.premium}
              onBuy={() => handleOpen(PackInputPackType.premium)}
              color="rare"
              disabled={openPack.isPending}
            />
            <PackCard
              title="Legendary Pack"
              description="8 creatures. High epic/legendary odds."
              cost={400}
              type={PackInputPackType.legendary}
              onBuy={() => handleOpen(PackInputPackType.legendary)}
              color="legendary"
              disabled={openPack.isPending}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

function PackCard({ title, description, cost, onBuy, disabled, color }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-${color}/30 bg-card p-4 flex items-center justify-between group`}>
      <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none`} />

      <div className="flex-1 pr-4 relative z-10">
        <h3 className={`text-lg font-bold text-${color}`}>{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="flex flex-col items-center gap-2 relative z-10">
        <Button
          onClick={onBuy}
          disabled={disabled}
          variant="secondary"
          className={`bg-${color}/10 hover:bg-${color}/20 text-white border border-${color}/30 shadow-[0_0_15px_rgba(var(--rarity-${color}),0.2)]`}
        >
          <Coins className={`w-4 h-4 mr-1 text-${color}`} />
          {cost}
        </Button>
      </div>
    </div>
  );
}
