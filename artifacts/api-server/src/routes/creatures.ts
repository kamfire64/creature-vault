import { Router, type IRouter } from "express";
import { db } from "../db.js";

const router: IRouter = Router();

const CURRENT_USER_ID = 1;

router.get("/creatures", (_req, res) => {
  const creatures = db
    .prepare(
      "SELECT id, name, rarity, type, attack, defense, speed, health, power_score as powerScore, image_url as imageUrl FROM creatures"
    )
    .all();
  res.json(creatures);
});

router.get("/creatures/inventory", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT oc.id, oc.creature_id as creatureId, c.name, c.rarity, c.type,
              c.attack, c.defense, c.speed, c.health, c.power_score as powerScore,
              c.image_url as imageUrl, oc.acquired_at as acquiredAt,
              oc.listed_for_sale as listedForSale, oc.xp
       FROM owned_creatures oc
       JOIN creatures c ON c.id = oc.creature_id
       WHERE oc.user_id = ?
       ORDER BY oc.id DESC`
    )
    .all(CURRENT_USER_ID) as Array<{
    id: number; creatureId: number; name: string; rarity: string; type: string;
    attack: number; defense: number; speed: number; health: number;
    powerScore: number; imageUrl: string; acquiredAt: string;
    listedForSale: number; xp: number;
  }>;
  const result = rows.map((r) => ({ ...r, listedForSale: r.listedForSale === 1 }));
  res.json(result);
});

router.get("/creatures/inventory/stats", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.rarity, c.power_score as powerScore, c.name
       FROM owned_creatures oc
       JOIN creatures c ON c.id = oc.creature_id
       WHERE oc.user_id = ?`
    )
    .all(CURRENT_USER_ID) as Array<{ rarity: string; powerScore: number; name: string }>;

  const byRarity: Record<string, number> = { Common: 0, Rare: 0, Epic: 0, Legendary: 0 };
  let totalPower = 0;
  let strongest: { name: string; powerScore: number; rarity: string } | null = null;

  for (const r of rows) {
    byRarity[r.rarity] = (byRarity[r.rarity] ?? 0) + 1;
    totalPower += r.powerScore;
    if (!strongest || r.powerScore > strongest.powerScore) {
      strongest = { name: r.name, powerScore: r.powerScore, rarity: r.rarity };
    }
  }

  res.json({ total: rows.length, byRarity, totalPower, strongestCreature: strongest });
});

export default router;
