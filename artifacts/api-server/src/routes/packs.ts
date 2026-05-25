import { Router, type IRouter } from "express";
import { db } from "../db.js";

const router: IRouter = Router();

const CURRENT_USER_ID = 1;

const PACK_CONFIG: Record<string, { cost: number; size: number; rarityWeights: Record<string, number> }> = {
  basic: {
    cost: 50,
    size: 3,
    rarityWeights: { Common: 70, Rare: 20, Epic: 8, Legendary: 2 },
  },
  premium: {
    cost: 150,
    size: 5,
    rarityWeights: { Common: 45, Rare: 35, Epic: 15, Legendary: 5 },
  },
  legendary: {
    cost: 400,
    size: 8,
    rarityWeights: { Common: 20, Rare: 35, Epic: 30, Legendary: 15 },
  },
};

function pickRarity(weights: Record<string, number>): string {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return "Common";
}

router.post("/packs/open", (req, res) => {
  const { packType } = req.body as { packType: string };
  const config = PACK_CONFIG[packType];
  if (!config) { res.status(400).json({ error: "Invalid pack type" }); return; }

  const user = db.prepare("SELECT coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as { coins: number } | undefined;
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.coins < config.cost) {
    res.status(400).json({ error: `Not enough coins. Need ${config.cost}, have ${user.coins}.` });
    return;
  }

  const insertOwned = db.prepare("INSERT INTO owned_creatures (user_id, creature_id) VALUES (?, ?)");
  const getOwned = db.prepare(
    `SELECT oc.id, oc.creature_id as creatureId, c.name, c.rarity, c.type,
            c.attack, c.defense, c.speed, c.health, c.power_score as powerScore,
            c.image_url as imageUrl, oc.acquired_at as acquiredAt, oc.listed_for_sale as listedForSale, oc.xp
     FROM owned_creatures oc
     JOIN creatures c ON c.id = oc.creature_id
     WHERE oc.id = ?`
  );

  const creaturesReceived: unknown[] = [];
  const openTx = db.transaction(() => {
    db.prepare("UPDATE users SET coins = coins - ? WHERE id = ?").run(config.cost, CURRENT_USER_ID);
    for (let i = 0; i < config.size; i++) {
      const rarity = pickRarity(config.rarityWeights);
      const creature = db
        .prepare("SELECT id FROM creatures WHERE rarity = ? ORDER BY RANDOM() LIMIT 1")
        .get(rarity) as { id: number } | undefined;
      if (!creature) continue;
      const result = insertOwned.run(CURRENT_USER_ID, creature.id);
      const owned = getOwned.get(result.lastInsertRowid) as {
        id: number; creatureId: number; name: string; rarity: string; type: string;
        attack: number; defense: number; speed: number; health: number;
        powerScore: number; imageUrl: string; acquiredAt: string; listedForSale: number; xp: number;
      };
      if (owned) creaturesReceived.push({ ...owned, listedForSale: owned.listedForSale === 1 });
    }
  });

  openTx();

  const updatedUser = db.prepare("SELECT coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as { coins: number };
  res.json({
    creaturesReceived,
    coinsSpent: config.cost,
    coinsRemaining: updatedUser.coins,
  });
});

export default router;
