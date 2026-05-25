import { cn } from "@/lib/utils";

interface PixelCreatureProps {
  name: string;
  rarity: string;
  type?: string;
  size?: number;
  className?: string;
}

// 8×8 pixel grids — index into TYPE_PALETTES[type][value]
// 0=transparent 1=darkest 2=body 3=mid 4=light 5=accent(eyes/special)

const FIRE_LIZARD = [
  0,1,0,1,1,0,1,0,
  0,1,2,2,2,2,1,0,
  1,2,3,5,5,3,2,1,
  1,2,2,2,2,2,2,1,
  1,2,2,2,2,2,2,1,
  0,1,2,1,1,2,1,0,
  0,1,1,0,0,1,1,0,
  0,0,4,4,4,4,0,0,
];

const LAVA_BEETLE = [
  0,0,1,0,0,1,0,0,
  0,1,2,1,1,2,1,0,
  1,2,5,2,2,5,2,1,
  1,3,2,1,1,2,3,1,
  1,2,2,2,2,2,2,1,
  1,3,2,2,2,2,3,1,
  0,1,2,2,2,2,1,0,
  1,1,0,0,0,0,1,1,
];

const WATER_TURTLE = [
  0,0,1,2,2,1,0,0,
  0,0,1,5,5,1,0,0,
  0,0,0,1,1,0,0,0,
  0,1,1,1,1,1,1,0,
  1,2,3,2,2,3,2,1,
  1,3,2,3,3,2,3,1,
  0,1,2,2,2,2,1,0,
  0,1,0,0,0,0,1,0,
];

const FROST_SERPENT = [
  0,0,1,2,2,1,0,0,
  0,0,1,4,4,1,0,0,
  0,1,2,1,1,2,1,0,
  0,1,2,3,3,2,1,0,
  1,2,3,4,4,3,2,1,
  0,1,2,3,3,2,1,0,
  0,0,1,2,2,1,0,0,
  0,0,0,1,1,0,0,0,
];

const NATURE_DEER = [
  1,0,1,0,0,1,0,1,
  1,0,1,0,0,1,0,1,
  0,1,1,1,1,1,1,0,
  0,1,5,2,2,5,1,0,
  0,0,1,2,2,1,0,0,
  0,1,2,3,3,2,1,0,
  1,2,3,2,2,3,2,1,
  0,0,1,1,1,1,0,0,
];

const MUSHROOM = [
  0,1,1,1,1,1,1,0,
  1,2,4,2,2,4,2,1,
  1,3,2,4,4,2,3,1,
  1,2,2,2,2,2,2,1,
  0,1,1,1,1,1,1,0,
  0,0,1,5,5,1,0,0,
  0,0,1,2,2,1,0,0,
  0,1,2,2,2,2,1,0,
];

const ELECTRIC_FOX = [
  1,0,0,0,0,0,0,1,
  1,2,0,0,0,0,2,1,
  0,1,2,2,2,2,1,0,
  0,1,3,5,5,3,1,0,
  0,0,1,2,2,1,0,0,
  0,1,2,3,3,2,1,0,
  1,2,2,2,2,2,1,0,
  0,0,1,4,4,0,0,0,
];

const THUNDER_BIRD = [
  0,0,0,1,1,0,0,0,
  0,0,1,5,5,1,0,0,
  0,0,1,2,2,1,0,0,
  1,2,2,2,2,2,2,1,
  2,3,2,2,2,2,3,2,
  1,2,2,1,1,2,2,1,
  0,0,1,4,4,1,0,0,
  0,1,2,0,0,2,1,0,
];

const STONE_GOLEM = [
  0,1,1,1,1,1,1,0,
  1,2,2,2,2,2,2,1,
  1,2,5,2,2,5,2,1,
  1,2,2,2,2,2,2,1,
  2,2,2,2,2,2,2,2,
  2,3,2,2,2,2,3,2,
  2,2,2,2,2,2,2,2,
  1,2,0,1,1,0,2,1,
];

const CRYSTAL_SPIDER = [
  1,0,0,1,1,0,0,1,
  0,1,0,1,1,0,1,0,
  0,1,2,5,5,2,1,0,
  1,2,2,2,2,2,2,1,
  1,3,4,2,2,4,3,1,
  1,2,3,2,2,3,2,1,
  0,1,2,2,2,2,1,0,
  1,0,0,1,1,0,0,1,
];

const SHADOW_WOLF = [
  1,0,0,0,0,0,0,1,
  1,2,0,0,0,0,2,1,
  0,1,2,2,2,2,1,0,
  0,1,5,2,2,5,1,0,
  0,1,2,2,2,2,1,0,
  0,1,2,3,3,2,1,0,
  1,2,3,2,2,3,2,1,
  0,1,1,0,0,1,1,0,
];

const MYSTIC_CAT = [
  0,1,0,0,0,0,1,0,
  1,2,1,0,0,1,2,1,
  0,1,2,2,2,2,1,0,
  0,0,1,4,4,1,0,0,
  0,1,5,2,2,5,1,0,
  0,0,1,2,2,1,0,0,
  0,1,2,3,3,2,1,0,
  0,1,1,0,4,4,0,0,
];

const LIGHT_BIRD = [
  0,5,0,0,0,0,5,0,
  0,0,1,2,2,1,0,0,
  0,0,1,4,4,1,0,0,
  4,4,4,2,2,4,4,4,
  3,4,3,2,2,3,4,3,
  1,3,2,2,2,2,3,1,
  0,0,1,4,4,1,0,0,
  0,1,2,0,0,2,1,0,
];

const ANCIENT_DRAGON = [
  0,1,0,1,1,0,1,0,
  0,1,2,2,2,2,1,0,
  1,2,5,2,2,5,2,1,
  1,2,2,2,2,2,2,1,
  4,2,2,2,2,2,2,4,
  4,3,2,2,2,2,3,4,
  1,2,3,2,2,3,2,1,
  0,0,4,4,4,4,0,0,
];

const TYPE_SPRITES: Record<string, number[][]> = {
  Fire: [FIRE_LIZARD, LAVA_BEETLE],
  Water: [WATER_TURTLE, FROST_SERPENT],
  Nature: [NATURE_DEER, MUSHROOM],
  Electric: [ELECTRIC_FOX, THUNDER_BIRD],
  Stone: [STONE_GOLEM, CRYSTAL_SPIDER],
  Shadow: [SHADOW_WOLF, MYSTIC_CAT],
  Light: [LIGHT_BIRD, LIGHT_BIRD],
};

// [transparent, outline/dark, body, mid, light/highlight, accent]
const TYPE_PALETTES: Record<string, string[]> = {
  Fire:     ["transparent", "#3d0a00", "#c0392b", "#e74c3c", "#ff8c42", "#ffde37"],
  Water:    ["transparent", "#001a33", "#0d5ea3", "#1e88e5", "#64b5f6", "#cce9ff"],
  Nature:   ["transparent", "#0d1f09", "#2e7d32", "#4caf50", "#81c784", "#d4ed52"],
  Electric: ["transparent", "#1a1400", "#b45309", "#f59e0b", "#fde68a", "#ffffff"],
  Stone:    ["transparent", "#1a1209", "#5d4037", "#795548", "#bcaaa4", "#e3d9d5"],
  Shadow:   ["transparent", "#0a0014", "#4a148c", "#7b1fa2", "#ce93d8", "#e040fb"],
  Light:    ["transparent", "#1a1300", "#b7890a", "#f9a825", "#fff176", "#ffffff"],
};

const RARITY_PALETTES: Record<string, string[]> = {
  Legendary: ["transparent", "#1a0d00", "#b45309", "#d97706", "#fbbf24", "#fef08a"],
};

const NAME_TO_TYPE: Record<string, string> = {
  Emberveil: "Fire", Stoneclaw: "Stone", Thornback: "Nature",
  Gloomfang: "Shadow", Ashspine: "Fire", Murkwing: "Shadow",
  Duskwhisper: "Shadow", Ironshard: "Stone", Frostcoil: "Water",
  Voidmaw: "Shadow", Cinderpelt: "Fire", Rimehollow: "Water",
  Gravecrest: "Stone", Silkfang: "Nature", Blazethorn: "Fire",
  Crystalwing: "Light", Bouldermaw: "Stone", Stormcoil: "Electric",
  Nightshroud: "Shadow", Ironveil: "Stone",
};

export function PixelCreature({ name, rarity, type: typeProp, size = 64, className }: PixelCreatureProps) {
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);

  const creatureType = typeProp || NAME_TO_TYPE[name] || "Fire";

  let grid: number[];
  let palette: string[];

  if (rarity === "Legendary") {
    grid = ANCIENT_DRAGON;
    palette = RARITY_PALETTES.Legendary;
  } else {
    const sprites = TYPE_SPRITES[creatureType] || TYPE_SPRITES.Fire;
    grid = sprites[hash % sprites.length];
    palette = TYPE_PALETTES[creatureType] || TYPE_PALETTES.Fire;
  }

  let animClass = "";
  if (rarity === "Legendary") animClass = "animate-legendary-idle";
  else if (rarity === "Epic") animClass = "animate-epic-idle";

  const shadowW = Math.round(size * 0.65);

  return (
    <div className={cn("relative inline-flex flex-col items-center", className)}>
      <div
        className={cn("pixel-rendering", animClass)}
        style={{ width: size, height: size, imageRendering: "pixelated" }}
      >
        <svg
          viewBox="0 0 8 8"
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ imageRendering: "pixelated" }}
        >
          {grid.map((val, i) => {
            if (val === 0) return null;
            const x = i % 8;
            const y = Math.floor(i / 8);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="1"
                height="1"
                fill={palette[val]}
              />
            );
          })}
        </svg>
      </div>
      {/* Drop shadow */}
      <div
        style={{
          position: "absolute",
          bottom: -4,
          left: "50%",
          transform: "translateX(-50%)",
          width: shadowW,
          height: 6,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 70%)",
          borderRadius: "50%",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
