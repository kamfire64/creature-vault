import { Router, type IRouter } from "express";
import { db } from "../db.js";

const router: IRouter = Router();

const CURRENT_USER_ID = 1;

const TYPE_ADVANTAGES: Record<string, string[]> = {
  Fire:     ["Nature", "Stone"],
  Water:    ["Fire", "Electric"],
  Nature:   ["Water", "Stone"],
  Shadow:   ["Light", "Nature"],
  Light:    ["Shadow", "Stone"],
  Electric: ["Water", "Light"],
  Stone:    ["Fire", "Shadow"],
};

const SKILLS: Record<string, { name: string; description: string }> = {
  Fire:     { name: "Ember Blast",   description: "1.5x dmg + 3-turn Burn (5% HP/turn)" },
  Water:    { name: "Tidal Wave",    description: "1.3x dmg, 35% Stun chance" },
  Nature:   { name: "Thornwall",     description: "Shield + Regen for 3 turns" },
  Shadow:   { name: "Soul Drain",    description: "1.4x dmg, drain 50% dealt as HP" },
  Light:    { name: "Holy Ray",      description: "1.5x dmg, cleanse all ailments" },
  Electric: { name: "Thunderstrike", description: "1.5x dmg, 35% Stun chance" },
  Stone:    { name: "Fortify",       description: "Heavy shield for 3 turns + defend stance" },
};

const TYPES = ["Fire", "Water", "Nature", "Shadow", "Light", "Electric", "Stone"];

function getTypeMultiplier(attackerType: string, defenderType: string): number {
  if (TYPE_ADVANTAGES[attackerType]?.includes(defenderType)) return 1.2;
  if (TYPE_ADVANTAGES[defenderType]?.includes(attackerType)) return 0.85;
  return 1.0;
}

type DbCreature = {
  id: number; name: string; rarity: string; type: string;
  attack: number; defense: number; speed: number; health: number;
  powerScore: number;
};

// POST /battles/setup — returns both teams ready for client-side battle
router.post("/battles/setup", (req, res) => {
  const { creatureIds } = req.body as { creatureIds: number[] };

  if (!Array.isArray(creatureIds) || creatureIds.length !== 3) {
    res.status(400).json({ error: "Select exactly 3 creatures." }); return;
  }

  const placeholders = creatureIds.map(() => "?").join(",");
  const playerRows = db
    .prepare(
      `SELECT oc.id, c.name, c.rarity, c.type, c.attack, c.defense, c.speed, c.health, c.power_score as powerScore
       FROM owned_creatures oc
       JOIN creatures c ON c.id = oc.creature_id
       WHERE oc.id IN (${placeholders}) AND oc.user_id = ? AND oc.listed_for_sale = 0`
    )
    .all(...creatureIds, CURRENT_USER_ID) as DbCreature[];

  if (playerRows.length !== 3) {
    res.status(400).json({ error: "One or more creatures not found in your inventory." }); return;
  }

  const avgPower = Math.round(playerRows.reduce((s, c) => s + c.powerScore, 0) / 3);

  const pool = db
    .prepare(
      `SELECT id, name, rarity, type, attack, defense, speed, health, power_score as powerScore
       FROM creatures ORDER BY RANDOM() LIMIT 12`
    )
    .all() as DbCreature[];

  const sorted = [...pool].sort((a, b) => Math.abs(a.powerScore - avgPower) - Math.abs(b.powerScore - avgPower));
  const opponentTeam = sorted.slice(0, 3);

  function withSkill(c: DbCreature) {
    const skill = SKILLS[c.type] ?? SKILLS.Fire;
    return { ...c, skillName: skill.name, skillDescription: skill.description };
  }

  res.json({
    playerTeam: playerRows.map(withSkill),
    opponentTeam: opponentTeam.map(withSkill),
    typeAdvantages: TYPE_ADVANTAGES,
  });
});

// POST /battles/complete — record outcome, grant coins + XP
router.post("/battles/complete", (req, res) => {
  const { outcome, survivingPlayerCreatureIds, turnsElapsed = 10, enemiesDefeated = 1 } = req.body as {
    outcome: "win" | "lose";
    survivingPlayerCreatureIds: number[];
    turnsElapsed?: number;
    enemiesDefeated?: number;
  };

  if (!["win", "lose"].includes(outcome)) {
    res.status(400).json({ error: "Invalid outcome." }); return;
  }

  const clamped = Math.min(Math.max(turnsElapsed, 1), 30);
  const survivingCount = Array.isArray(survivingPlayerCreatureIds) ? survivingPlayerCreatureIds.length : 0;
  const perfectWin = outcome === "win" && survivingCount === 3;

  let coinsEarned: number;
  let xpGained: number;

  if (outcome === "win") {
    coinsEarned = 60 + Math.round(clamped * 1.8) + (perfectWin ? 30 : 0) + (enemiesDefeated * 5);
    xpGained   = 40 + Math.round(clamped * 1.5) + (enemiesDefeated * 8);
  } else {
    coinsEarned = 15 + Math.round(clamped * 0.8) + (enemiesDefeated * 3);
    xpGained   = 10 + Math.round(clamped * 0.8);
  }

  db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(coinsEarned, CURRENT_USER_ID);

  if (survivingCount > 0 && Array.isArray(survivingPlayerCreatureIds)) {
    const ph = survivingPlayerCreatureIds.map(() => "?").join(",");
    db.prepare(
      `UPDATE owned_creatures SET xp = xp + ? WHERE id IN (${ph}) AND user_id = ?`
    ).run(xpGained, ...survivingPlayerCreatureIds, CURRENT_USER_ID);
  }

  const updatedUser = db.prepare("SELECT coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as { coins: number };

  res.json({ coinsEarned, xpGained, coinsRemaining: updatedUser.coins });
});

// Keep old endpoint for backward compat
router.post("/battles/start", (_req, res) => {
  res.status(410).json({ error: "Use /battles/setup instead." });
});

export { TYPE_ADVANTAGES, TYPES, getTypeMultiplier };
export default router;
