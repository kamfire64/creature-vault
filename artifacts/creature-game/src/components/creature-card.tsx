import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Sword, Shield, Zap, Heart } from "lucide-react";
import type { Creature, OwnedCreature } from "@workspace/api-client-react";
import { PixelCreature } from "./pixel-creature";

interface CreatureCardProps {
  creature: Creature | OwnedCreature;
  className?: string;
  onClick?: () => void;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  delayMs?: number;
  faceDown?: boolean;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  Fire: "bg-red-500/20 text-red-300 border-red-500/40",
  Water: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  Nature: "bg-green-500/20 text-green-300 border-green-500/40",
  Electric: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  Stone: "bg-stone-500/20 text-stone-300 border-stone-500/40",
  Shadow: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  Light: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
};

export function CreatureCard({ creature, className, onClick, badge, footer, delayMs = 0, faceDown = false }: CreatureCardProps) {
  const isOwned = "acquiredAt" in creature;
  const isListed = isOwned && (creature as OwnedCreature).listedForSale;

  const rarityClass = `bg-${creature.rarity.toLowerCase()}`;
  const borderClass = `border-${creature.rarity.toLowerCase()}`;
  const textClass = `text-${creature.rarity.toLowerCase()}`;
  const shadowClass = `shadow-${creature.rarity.toLowerCase()}`;

  if (faceDown) {
    return (
      <div
        className={cn(
          "relative rounded-xl border bg-card overflow-hidden flex items-center justify-center transition-all duration-300 aspect-[3/4] border-white/5",
          className
        )}
        style={{ animationDelay: `${delayMs}ms` }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="w-12 h-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
          <span className="text-white/20 font-bold text-xl">?</span>
        </div>
      </div>
    );
  }

  const typeColor = TYPE_BADGE_COLORS[creature.type] || TYPE_BADGE_COLORS.Fire;

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative rounded-xl border bg-card overflow-hidden flex flex-col transition-all duration-300",
        borderClass,
        creature.rarity === "Legendary" || creature.rarity === "Epic" ? shadowClass : "",
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {isListed && (
        <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-xs font-bold text-white border border-white/20">
          Listed
        </div>
      )}
      {badge && <div className="absolute top-2 right-2 z-10">{badge}</div>}

      <div className={cn("aspect-square w-full relative flex items-center justify-center p-4", rarityClass)}>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="relative z-10 w-24 h-24 flex items-center justify-center">
          <PixelCreature name={creature.name} rarity={creature.rarity} type={creature.type} size={88} />
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 relative bg-card flex-1">
        <div className="flex justify-between items-start gap-1">
          <h3 className="font-bold text-foreground leading-tight truncate text-sm">{creature.name}</h3>
          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold border-current bg-background/50 shrink-0", textClass)}>
            {creature.rarity}
          </Badge>
        </div>

        <div className="flex items-center gap-1">
          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", typeColor)}>
            {creature.type}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs font-mono text-muted-foreground">
          <Stat icon={Sword} value={creature.attack} label="ATK" />
          <Stat icon={Shield} value={creature.defense} label="DEF" />
          <Stat icon={Heart} value={creature.health} label="HP" />
          <Stat icon={Zap} value={creature.speed} label="SPD" />
        </div>

        <div className="mt-auto pt-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Power</span>
          <span className="font-mono font-bold text-primary">{creature.powerScore}</span>
        </div>

        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, value, label }: { icon: React.ElementType; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 opacity-70" />
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}
