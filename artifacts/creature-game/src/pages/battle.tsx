import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout";
import { CreatureCard } from "@/components/creature-card";
import {
  useGetInventory,
  useSetupBattle,
  useCompleteBattle,
  getGetMeQueryKey,
  getGetInventoryQueryKey,
  getGetInventoryStatsQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, Info, Shield, Sparkles, RefreshCw, X, Star, Flame } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { normalizeCreatureList } from "@/lib/normalize-creature-list";
import { PixelCreature } from "@/components/pixel-creature";
import { useBattleEngine, TYPE_ADVANTAGES, TYPE_COLORS, ULTIMATE_NAMES, type StatusState, type CreatureType } from "@/hooks/use-battle-engine";

const STATUS_ICONS: Record<string, string> = { burn: "🔥", shield: "🛡", stun: "⚡", regen: "✨" };
const STATUS_COLORS: Record<string, string> = {
  burn: "text-red-400 border-red-500/50 bg-red-500/10",
  regen: "text-green-400 border-green-500/50 bg-green-500/10",
  shield: "text-blue-400 border-blue-500/50 bg-blue-500/10",
  stun: "text-yellow-400 border-yellow-500/50 bg-yellow-500/10",
};

export default function BattlePage() {
  const { data: inventoryData, isLoading } = useGetInventory();
  const creatures = useMemo(
    () => normalizeCreatureList(inventoryData),
    [inventoryData],
  );
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const setupBattle = useSetupBattle();
  const completeBattle = useCompleteBattle();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showLog, setShowLog] = useState(false);

  const { state, initBattle, playerAction, cancelSwap } = useBattleEngine("normal");

  const handleToggle = (id: number, listed: boolean) => {
    if (listed) return;
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(x => x !== id));
    } else {
      if (selectedIds.length < 3) setSelectedIds([...selectedIds, id]);
    }
  };

  const handleStart = () => {
    if (selectedIds.length !== 3) return;
    setupBattle.mutate(
      { data: { creatureIds: selectedIds } },
      {
        onSuccess: (res) => { initBattle(res); },
        onError: (err) => {
          toast({ title: "Battle failed", description: err.data?.error || "Unknown error", variant: "destructive" });
        }
      }
    );
  };

  useEffect(() => {
    if (state.result && state.phase === "result" && !completeBattle.isPending && !completeBattle.isSuccess) {
      completeBattle.mutate(
        {
          data: {
            outcome: state.result.outcome,
            survivingPlayerCreatureIds: state.result.survivingIds,
            turnsElapsed: state.result.turnsElapsed,
            enemiesDefeated: state.result.enemiesDefeated,
          }
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetInventoryQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetInventoryStatsQueryKey() });
          }
        }
      );
    }
  }, [state.result, state.phase]);

  const availableCreatures = useMemo(
    () => creatures.filter((c) => !c.listedForSale),
    [creatures],
  );

  // ─── RESULT SCREEN ───────────────────────────────────────────────────────────
  if (state.phase === "result" && state.result && completeBattle.isSuccess) {
    const outcome = state.result.outcome;
    const { coinsEarned, xpGained } = completeBattle.data;
    const isWin = outcome === "win";
    const turns = state.result.turnsElapsed;
    const defeated = state.result.enemiesDefeated;

    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 space-y-6 absolute inset-0 z-50">
        <div className={cn("text-center py-8 px-10 rounded-3xl border-2 shadow-2xl animate-battle-enter w-full max-w-md",
          isWin ? "bg-legendary/10 border-legendary/30 shadow-legendary/20" : "bg-destructive/10 border-destructive/30")}>
          <h2 className={cn("text-5xl font-black mb-3 tracking-tight", isWin ? "text-legendary drop-shadow-md" : "text-destructive")}>
            {isWin ? "VICTORY!" : "DEFEAT"}
          </h2>
          <div className="flex justify-center gap-6 text-lg font-bold mb-4">
            <p className="text-primary">+{coinsEarned} coins</p>
            <p className="text-accent">+{xpGained} XP</p>
          </div>
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <span>{turns} turns fought</span>
            <span>{defeated} enemies defeated</span>
          </div>
        </div>

        <div className="w-full max-w-md space-y-3 animate-battle-enter" style={{ animationDelay: "0.2s" }}>
          <h3 className="font-bold text-center text-muted-foreground uppercase tracking-widest text-xs">Your Team</h3>
          <div className="flex justify-center gap-4">
            {state.playerTeam.map(c => {
              const alive = c.currentHp > 0;
              return (
                <div key={c.id} className={cn("flex flex-col items-center bg-card p-3 rounded-2xl border transition-all",
                  alive ? "border-white/20 shadow-lg" : "border-white/5 opacity-40 grayscale")}>
                  <PixelCreature name={c.name} rarity={c.rarity} type={c.type} size={56} />
                  <span className="text-xs font-bold truncate w-20 text-center mt-2">{c.name}</span>
                  {alive && <span className="text-[10px] text-accent font-bold mt-1">+{xpGained} XP</span>}
                </div>
              );
            })}
          </div>
        </div>

        <Button
          className="w-full max-w-md h-14 text-lg font-bold rounded-xl animate-battle-enter"
          style={{ animationDelay: "0.4s" }}
          onClick={() => window.location.reload()}
        >
          Battle Again
        </Button>
      </div>
    );
  }

  // ─── BATTLE ARENA ────────────────────────────────────────────────────────────
  if (state.phase === "player-turn" || state.phase === "enemy-turn" || state.phase === "animating") {
    const p = state.playerTeam[state.activePlayerIdx];
    const e = state.enemyTeam[state.activeEnemyIdx];
    const a = state.anim;

    const pTypeColor = TYPE_COLORS[p.type as CreatureType] || "#aaa";
    const eTypeColor = TYPE_COLORS[e.type as CreatureType] || "#aaa";

    const renderHpBar = (hp: number, max: number) => {
      const pct = (hp / max) * 100;
      const color = pct < 25 ? "bg-red-500" : pct < 50 ? "bg-yellow-500" : "bg-green-500";
      return (
        <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10 relative">
          <div className={cn("h-full transition-all duration-500", color)} style={{ width: `${Math.max(0, pct)}%` }} />
        </div>
      );
    };

    const renderEnergyBar = (energy: number) => (
      <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
        <div
          className={cn("h-full transition-all duration-300", energy >= 100 ? "bg-yellow-300 animate-pulse" : "bg-yellow-500/70")}
          style={{ width: `${energy}%` }}
        />
      </div>
    );

    const renderStatuses = (statuses: StatusState[]) => (
      <div className="flex gap-1 flex-wrap">
        {statuses.map((s, i) => (
          <div key={i} className={cn("text-[9px] font-bold px-1 py-0.5 rounded border flex items-center gap-0.5", STATUS_COLORS[s.type])}>
            {STATUS_ICONS[s.type]}{s.turnsLeft}
          </div>
        ))}
      </div>
    );

    const typeAdv = TYPE_ADVANTAGES[p.type]?.includes(e.type) ? 1 : TYPE_ADVANTAGES[e.type]?.includes(p.type) ? -1 : 0;
    const isPlayerTurn = state.phase === "player-turn";
    const canSkill = p.energy >= 60;
    const canUltimate = p.energy >= 100 && (p.rarity === "Epic" || p.rarity === "Legendary");

    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
        {/* Screen flash */}
        {a.screenFlash && (
          <div className="fixed inset-0 z-50 animate-screen-flash pointer-events-none" style={{ backgroundColor: a.screenFlash + "55" }} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-card/50 backdrop-blur border-b border-white/5 shrink-0">
          <div className="font-mono font-bold text-primary text-sm">TURN {state.turn}</div>
          <div className={cn("px-3 py-1 rounded-full text-xs font-bold border",
            isPlayerTurn ? "bg-primary/20 text-primary border-primary/50" : "bg-destructive/20 text-destructive border-destructive/50")}>
            {isPlayerTurn ? "YOUR TURN" : state.phase === "enemy-turn" ? "ENEMY TURN" : "···"}
          </div>
          <Button variant="ghost" size="icon" className="relative h-8 w-8" onClick={() => setShowLog(!showLog)}>
            <Info className="w-4 h-4" />
            {state.log.length > 0 && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />}
          </Button>
        </div>

        {/* Battle log overlay */}
        {showLog && (
          <div className="absolute top-14 right-3 left-3 z-40 bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl p-3 max-h-52 overflow-y-auto shadow-2xl space-y-1">
            {state.log.slice().reverse().map(l => (
              <div key={l.id} className={cn("text-xs font-medium",
                l.kind === "attack" ? "text-foreground" :
                l.kind === "skill" ? "text-primary" :
                l.kind === "ultimate" ? "text-yellow-300 font-bold" :
                l.kind === "ko" ? "text-destructive font-bold" :
                l.kind === "status" ? "text-orange-300" :
                l.kind === "swap" ? "text-blue-300" :
                "text-muted-foreground")}>
                {l.text}
              </div>
            ))}
          </div>
        )}

        {/* Arena */}
        <div className="flex-1 flex flex-col px-4 py-3 gap-4 min-h-0">

          {/* Enemy section */}
          <div className="flex items-start gap-3">
            {/* Enemy stats (left) */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-bold text-sm truncate">{e.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0" style={{ color: eTypeColor, borderColor: eTypeColor + "44", background: eTypeColor + "15" }}>{e.type}</span>
              </div>
              <div>
                {renderHpBar(e.currentHp, e.maxHp)}
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
                  <span>{Math.ceil(e.currentHp)}/{e.maxHp}</span>
                  <span>E:{e.energy}</span>
                </div>
              </div>
              {renderEnergyBar(e.energy)}
              {e.statuses.length > 0 && <div className="mt-0.5">{renderStatuses(e.statuses)}</div>}
            </div>

            {/* Enemy sprite (right) */}
            <div className="shrink-0 relative">
              <div className={cn(
                "transition-transform duration-300 relative",
                a.enemyLunge ? "-translate-x-6" : "",
                a.enemyShake ? "animate-battle-shake" : "",
                a.enemyFade ? "opacity-0 transition-opacity duration-500" : "",
                a.ultiGlow ? `type-glow-${a.ultiGlow.toLowerCase()} animate-ulti-pulse` : (a.skillGlow && state.phase === "enemy-turn" ? `type-glow-${a.skillGlow.toLowerCase()}` : ""),
              )}>
                <PixelCreature name={e.name} rarity={e.rarity} type={e.type} size={88} className="transform scale-x-[-1]" />
                {a.damageEnemy !== null && (
                  <div className={cn("absolute -top-2 left-1/2 -translate-x-1/2 font-black animate-float-up drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10 whitespace-nowrap", a.critEnemy ? "text-yellow-300 text-2xl" : "text-red-400 text-xl")}>
                    {a.critEnemy ? "⚡ " : ""}-{a.damageEnemy}
                  </div>
                )}
                {a.healEnemy !== null && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl font-black text-green-400 animate-float-up drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10">
                    +{a.healEnemy}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* VS Divider */}
          <div className="relative flex justify-center items-center">
            <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="bg-background px-4 py-1 rounded-full border border-white/10 text-[10px] font-bold tracking-widest text-muted-foreground z-10 flex items-center gap-2">
              VS
              {typeAdv === 1 && <span className="text-green-400 border border-green-500/30 bg-green-500/10 px-1.5 rounded">⚡ ADVANTAGE</span>}
              {typeAdv === -1 && <span className="text-red-400 border border-red-500/30 bg-red-500/10 px-1.5 rounded">⚠ RESIST</span>}
              {typeAdv === 0 && <span className="text-muted-foreground">Neutral</span>}
            </div>
          </div>

          {/* Player section */}
          <div className="flex items-start gap-3 flex-row-reverse">
            {/* Player stats (right) */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0 items-end">
              <div className="flex items-baseline justify-between gap-1 w-full flex-row-reverse">
                <span className="font-bold text-sm truncate">{p.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0" style={{ color: pTypeColor, borderColor: pTypeColor + "44", background: pTypeColor + "15" }}>{p.type}</span>
              </div>
              <div className="w-full">
                {renderHpBar(p.currentHp, p.maxHp)}
                <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-0.5">
                  <span>{Math.ceil(p.currentHp)}/{p.maxHp}</span>
                  <span>E:{p.energy}</span>
                </div>
              </div>
              {renderEnergyBar(p.energy)}
              {p.statuses.length > 0 && <div className="mt-0.5 flex justify-end">{renderStatuses(p.statuses)}</div>}
            </div>

            {/* Player sprite (left) */}
            <div className="shrink-0 relative">
              <div className={cn(
                "transition-transform duration-300 relative",
                a.playerLunge ? "translate-x-6" : "",
                a.playerShake ? "animate-battle-shake" : "",
                a.playerFade ? "opacity-0 transition-opacity duration-500" : "",
                a.ultiGlow ? `type-glow-${a.ultiGlow.toLowerCase()} animate-ulti-pulse` : (a.skillGlow && state.phase === "player-turn" ? `type-glow-${a.skillGlow.toLowerCase()}` : ""),
              )}>
                <PixelCreature name={p.name} rarity={p.rarity} type={p.type} size={88} />
                {a.damagePlayer !== null && (
                  <div className={cn("absolute -top-2 left-1/2 -translate-x-1/2 font-black animate-float-up drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10 whitespace-nowrap", a.critPlayer ? "text-yellow-300 text-2xl" : "text-red-400 text-xl")}>
                    {a.critPlayer ? "⚡ " : ""}-{a.damagePlayer}
                  </div>
                )}
                {a.healPlayer !== null && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-xl font-black text-green-400 animate-float-up drop-shadow-[0_2px_2px_rgba(0,0,0,1)] z-10">
                    +{a.healPlayer}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-card/80 backdrop-blur-xl border-t border-white/10 p-3 pb-safe shrink-0 space-y-2">
          {state.pendingSwapMode ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold">Send out:</span>
                <Button variant="ghost" size="sm" onClick={cancelSwap} className="h-7 text-xs">
                  <X className="w-3 h-3 mr-1" /> Cancel
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {state.playerTeam.map((c, i) => {
                  const alive = c.currentHp > 0;
                  const active = i === state.activePlayerIdx;
                  return (
                    <Button
                      key={c.id}
                      variant="outline"
                      className={cn("h-auto py-2 flex-col gap-1", !alive && "opacity-40 grayscale", active && "border-primary bg-primary/10")}
                      disabled={!alive || active}
                      onClick={() => playerAction("swap", i)}
                    >
                      <PixelCreature name={c.name} rarity={c.rarity} type={c.type} size={28} />
                      <span className="text-[9px] truncate w-full text-center">{c.name}</span>
                      <div className="w-full">{renderHpBar(c.currentHp, c.maxHp)}</div>
                    </Button>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="lg"
                  className="font-bold text-sm bg-red-600 hover:bg-red-500 text-white h-12"
                  disabled={!isPlayerTurn}
                  onClick={() => playerAction("attack")}
                >
                  <Swords className="w-4 h-4 mr-1.5" /> Attack
                  <span className="ml-auto text-[9px] opacity-70">+25⚡</span>
                </Button>

                <Button
                  size="lg"
                  className={cn("font-bold text-sm relative overflow-hidden h-12", `type-bg-${p.type.toLowerCase()}`)}
                  variant="outline"
                  disabled={!isPlayerTurn || !canSkill}
                  onClick={() => playerAction("skill")}
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span className="truncate">{p.skillName}</span>
                  {!canSkill && (
                    <div className="absolute inset-0 bg-background/75 flex items-center justify-center text-xs text-muted-foreground font-mono">
                      Need {60 - p.energy} more ⚡
                    </div>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  className="font-bold text-sm h-12"
                  disabled={!isPlayerTurn}
                  onClick={() => playerAction("defend")}
                >
                  <Shield className="w-4 h-4 mr-1.5" /> Defend
                  <span className="ml-auto text-[9px] opacity-70">+35⚡</span>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="font-bold text-sm h-12"
                  disabled={!isPlayerTurn || state.playerTeam.filter(c => c.currentHp > 0).length <= 1}
                  onClick={() => playerAction("swap")}
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Swap
                </Button>
              </div>

              {/* Ultimate button — Epic/Legendary only */}
              {(p.rarity === "Epic" || p.rarity === "Legendary") && (
                <Button
                  size="lg"
                  className={cn(
                    "w-full font-bold h-11 relative overflow-hidden transition-all",
                    canUltimate
                      ? "bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-600 text-black animate-ulti-ready shadow-lg shadow-yellow-500/30"
                      : "opacity-60"
                  )}
                  disabled={!isPlayerTurn || !canUltimate}
                  onClick={() => playerAction("ultimate")}
                >
                  <Star className="w-4 h-4 mr-1.5 fill-current" />
                  ULTIMATE — {ULTIMATE_NAMES[p.type as CreatureType]}
                  {!canUltimate && (
                    <span className="ml-auto text-[10px] font-mono opacity-70">{p.energy}/100 ⚡</span>
                  )}
                  {canUltimate && <Flame className="w-4 h-4 ml-1.5 fill-current" />}
                </Button>
              )}

              {/* Mini team row */}
              <div className="flex justify-center gap-2 pt-1">
                {state.playerTeam.map((c, i) => (
                  <div key={c.id} className={cn(
                    "w-9 h-9 rounded bg-card border flex items-center justify-center transition-all",
                    c.currentHp <= 0 ? "opacity-25 grayscale border-white/5" :
                    i === state.activePlayerIdx ? "border-primary ring-2 ring-primary/30" : "border-white/10"
                  )}>
                    <PixelCreature name={c.name} rarity={c.rarity} type={c.type} size={22} />
                  </div>
                ))}
                <div className="w-px bg-white/10 self-stretch mx-1" />
                {state.enemyTeam.map((c, i) => (
                  <div key={c.id} className={cn(
                    "w-9 h-9 rounded bg-card border flex items-center justify-center transition-all",
                    c.currentHp <= 0 ? "opacity-25 grayscale border-white/5" :
                    i === state.activeEnemyIdx ? "border-destructive ring-2 ring-destructive/30" : "border-white/10"
                  )}>
                    <PixelCreature name={c.name} rarity={c.rarity} type={c.type} size={22} className="scale-x-[-1]" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── SELECTION SCREEN ────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-4 flex flex-col min-h-full space-y-6 pb-36">
        <div className="text-center">
          <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
            <Swords className="text-primary" /> Battle Arena
          </h2>
          <p className="text-muted-foreground text-sm mt-1">Select 3 creatures to battle.</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="aspect-[3/4] bg-card rounded-xl animate-pulse" />)}
          </div>
        ) : availableCreatures.length < 3 ? (
          <div className="text-center py-12 px-4 border border-dashed border-white/10 rounded-2xl bg-card/50">
            <Swords className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-lg mb-1">Not enough creatures</h3>
            <p className="text-sm text-muted-foreground mb-4">You need at least 3 creatures to battle.</p>
            <Link href="/packs" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Open Packs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {availableCreatures.map(c => {
              const isSelected = selectedIds.includes(c.id);
              return (
                <div key={c.id} className="relative">
                  <CreatureCard
                    creature={c}
                    onClick={() => handleToggle(c.id, c.listedForSale)}
                    className={cn(
                      isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]",
                      c.listedForSale && "opacity-50 cursor-not-allowed"
                    )}
                  />
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-lg z-20">
                      {selectedIds.indexOf(c.id) + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-white/10 z-40 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold">Selected: {selectedIds.length}/3</span>
        </div>
        <Button
          className="w-full"
          size="lg"
          disabled={selectedIds.length !== 3 || setupBattle.isPending}
          onClick={handleStart}
        >
          {setupBattle.isPending ? "Preparing..." : "Begin Battle"}
        </Button>
      </div>
    </Layout>
  );
}
