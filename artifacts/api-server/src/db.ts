import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "game.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    coins INTEGER NOT NULL DEFAULT 500
  );

  CREATE TABLE IF NOT EXISTS creatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    rarity TEXT NOT NULL CHECK(rarity IN ('Common', 'Rare', 'Epic', 'Legendary')),
    type TEXT NOT NULL DEFAULT 'Fire',
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    health INTEGER NOT NULL,
    power_score INTEGER NOT NULL,
    image_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS owned_creatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    creature_id INTEGER NOT NULL REFERENCES creatures(id),
    acquired_at TEXT NOT NULL DEFAULT (datetime('now')),
    listed_for_sale INTEGER NOT NULL DEFAULT 0,
    xp INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL REFERENCES users(id),
    owned_creature_id INTEGER NOT NULL REFERENCES owned_creatures(id),
    price INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    active INTEGER NOT NULL DEFAULT 1
  );
`);

// Migrations for existing databases
try { db.exec("ALTER TABLE creatures ADD COLUMN type TEXT NOT NULL DEFAULT 'Fire'"); } catch {}
try { db.exec("ALTER TABLE owned_creatures ADD COLUMN xp INTEGER NOT NULL DEFAULT 0"); } catch {}

function generateStats(rarity: string): { attack: number; defense: number; speed: number; health: number; powerScore: number } {
  const budgets: Record<string, number> = {
    Common: 100,
    Rare: 160,
    Epic: 240,
    Legendary: 360,
  };
  const budget = budgets[rarity] ?? 100;
  const parts = [Math.random(), Math.random(), Math.random(), Math.random()];
  const sum = parts.reduce((a, b) => a + b, 0);
  const [a, b, c, d] = parts.map((p) => Math.max(10, Math.round((p / sum) * budget)));
  const powerScore = Math.round(a * 0.35 + b * 0.25 + c * 0.2 + d * 0.2);
  return { attack: a, defense: b, speed: c, health: d, powerScore };
}

const creatureTemplates = [
  { name: "Emberveil",   rarity: "Legendary", type: "Fire" },
  { name: "Stoneclaw",   rarity: "Epic",      type: "Stone" },
  { name: "Thornback",   rarity: "Rare",      type: "Nature" },
  { name: "Gloomfang",   rarity: "Rare",      type: "Shadow" },
  { name: "Ashspine",    rarity: "Common",    type: "Fire" },
  { name: "Murkwing",    rarity: "Common",    type: "Shadow" },
  { name: "Duskwhisper", rarity: "Epic",      type: "Shadow" },
  { name: "Ironshard",   rarity: "Common",    type: "Stone" },
  { name: "Frostcoil",   rarity: "Rare",      type: "Water" },
  { name: "Voidmaw",     rarity: "Legendary", type: "Shadow" },
  { name: "Cinderpelt",  rarity: "Common",    type: "Fire" },
  { name: "Rimehollow",  rarity: "Rare",      type: "Water" },
  { name: "Gravecrest",  rarity: "Epic",      type: "Stone" },
  { name: "Silkfang",    rarity: "Common",    type: "Nature" },
  { name: "Blazethorn",  rarity: "Common",    type: "Fire" },
  { name: "Crystalwing", rarity: "Epic",      type: "Light" },
  { name: "Bouldermaw",  rarity: "Common",    type: "Stone" },
  { name: "Stormcoil",   rarity: "Rare",      type: "Electric" },
  { name: "Nightshroud", rarity: "Legendary", type: "Shadow" },
  { name: "Ironveil",    rarity: "Common",    type: "Stone" },
];

const existingCreatures = db.prepare("SELECT COUNT(*) as count FROM creatures").get() as { count: number };
if (existingCreatures.count === 0) {
  const insertCreature = db.prepare(
    "INSERT INTO creatures (name, rarity, type, attack, defense, speed, health, power_score, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const tmpl of creatureTemplates) {
    const stats = generateStats(tmpl.rarity);
    insertCreature.run(
      tmpl.name, tmpl.rarity, tmpl.type,
      stats.attack, stats.defense, stats.speed, stats.health, stats.powerScore,
      `/api/creatures/image/${tmpl.name.toLowerCase()}`
    );
  }
} else {
  // Backfill types for existing creatures that still have default 'Fire'
  const updateType = db.prepare("UPDATE creatures SET type = ? WHERE name = ? AND type = 'Fire'");
  for (const tmpl of creatureTemplates) {
    if (tmpl.type !== "Fire") updateType.run(tmpl.type, tmpl.name);
  }
}

const existingUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
if (existingUsers.count === 0) {
  db.prepare("INSERT INTO users (username, coins) VALUES (?, ?)").run("Trainer", 500);
  db.prepare("INSERT INTO users (username, coins) VALUES (?, ?)").run("RivalBot", 9999);

  const userId1 = (db.prepare("SELECT id FROM users WHERE username = 'Trainer'").get() as { id: number }).id;
  const userId2 = (db.prepare("SELECT id FROM users WHERE username = 'RivalBot'").get() as { id: number }).id;
  const allCreatures = db.prepare("SELECT id FROM creatures ORDER BY RANDOM() LIMIT 6").all() as { id: number }[];
  const insertOwned = db.prepare("INSERT INTO owned_creatures (user_id, creature_id) VALUES (?, ?)");
  for (const c of allCreatures.slice(0, 3)) insertOwned.run(userId1, c.id);
  for (const c of allCreatures.slice(3, 6)) insertOwned.run(userId2, c.id);

  const rivalOwned = db.prepare("SELECT id FROM owned_creatures WHERE user_id = ?").all(userId2) as { id: number }[];
  if (rivalOwned.length > 0) {
    db.prepare("INSERT INTO marketplace_listings (seller_id, owned_creature_id, price) VALUES (?, ?, ?)").run(userId2, rivalOwned[0].id, 80);
    db.prepare("UPDATE owned_creatures SET listed_for_sale = 1 WHERE id = ?").run(rivalOwned[0].id);
    if (rivalOwned[1]) {
      db.prepare("INSERT INTO marketplace_listings (seller_id, owned_creature_id, price) VALUES (?, ?, ?)").run(userId2, rivalOwned[1].id, 150);
      db.prepare("UPDATE owned_creatures SET listed_for_sale = 1 WHERE id = ?").run(rivalOwned[1].id);
    }
  }
}

export { generateStats };
