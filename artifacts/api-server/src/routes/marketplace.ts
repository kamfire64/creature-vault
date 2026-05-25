import { Router, type IRouter } from "express";
import { db } from "../db.js";

const router: IRouter = Router();

const CURRENT_USER_ID = 1;

function getListingRow(listingId: number) {
  return db
    .prepare(
      `SELECT ml.id, ml.price, u.username as sellerUsername, ml.created_at as createdAt,
              oc.id as oc_id, oc.creature_id as creatureId, c.name, c.rarity, c.type,
              c.attack, c.defense, c.speed, c.health, c.power_score as powerScore,
              c.image_url as imageUrl, oc.acquired_at as acquiredAt, oc.listed_for_sale as listedForSale, oc.xp
       FROM marketplace_listings ml
       JOIN users u ON u.id = ml.seller_id
       JOIN owned_creatures oc ON oc.id = ml.owned_creature_id
       JOIN creatures c ON c.id = oc.creature_id
       WHERE ml.id = ? AND ml.active = 1`
    )
    .get(listingId) as
    | (Record<string, unknown> & {
        oc_id: number; creatureId: number; name: string; rarity: string; type: string;
        attack: number; defense: number; speed: number; health: number;
        powerScore: number; imageUrl: string; acquiredAt: string; listedForSale: number; xp: number;
        id: number; price: number; sellerUsername: string; createdAt: string;
      })
    | undefined;
}

function formatListing(row: ReturnType<typeof getListingRow>) {
  if (!row) return null;
  return {
    id: row.id,
    price: row.price,
    sellerUsername: row.sellerUsername,
    createdAt: row.createdAt,
    creature: {
      id: row.oc_id,
      creatureId: row.creatureId,
      name: row.name,
      rarity: row.rarity,
      type: row.type,
      attack: row.attack,
      defense: row.defense,
      speed: row.speed,
      health: row.health,
      powerScore: row.powerScore,
      imageUrl: row.imageUrl,
      acquiredAt: row.acquiredAt,
      listedForSale: row.listedForSale === 1,
      xp: row.xp,
    },
  };
}

router.get("/marketplace", (_req, res) => {
  const rows = db
    .prepare(
      `SELECT ml.id, ml.price, u.username as sellerUsername, ml.created_at as createdAt,
              oc.id as oc_id, oc.creature_id as creatureId, c.name, c.rarity, c.type,
              c.attack, c.defense, c.speed, c.health, c.power_score as powerScore,
              c.image_url as imageUrl, oc.acquired_at as acquiredAt, oc.listed_for_sale as listedForSale, oc.xp
       FROM marketplace_listings ml
       JOIN users u ON u.id = ml.seller_id
       JOIN owned_creatures oc ON oc.id = ml.owned_creature_id
       JOIN creatures c ON c.id = oc.creature_id
       WHERE ml.active = 1
       ORDER BY ml.created_at DESC`
    )
    .all() as Array<ReturnType<typeof getListingRow>>;
  res.json(rows.map(formatListing));
});

router.post("/marketplace", (req, res) => {
  const { ownedCreatureId, price } = req.body as { ownedCreatureId: number; price: number };
  if (!ownedCreatureId || !price || price < 1) {
    res.status(400).json({ error: "Invalid ownedCreatureId or price" });
    return;
  }

  const owned = db
    .prepare("SELECT id, listed_for_sale FROM owned_creatures WHERE id = ? AND user_id = ?")
    .get(ownedCreatureId, CURRENT_USER_ID) as { id: number; listed_for_sale: number } | undefined;
  if (!owned) { res.status(400).json({ error: "Creature not found in your inventory" }); return; }
  if (owned.listed_for_sale) { res.status(400).json({ error: "Already listed for sale" }); return; }

  const createTx = db.transaction(() => {
    db.prepare("UPDATE owned_creatures SET listed_for_sale = 1 WHERE id = ?").run(ownedCreatureId);
    const result = db
      .prepare("INSERT INTO marketplace_listings (seller_id, owned_creature_id, price) VALUES (?, ?, ?)")
      .run(CURRENT_USER_ID, ownedCreatureId, price);
    return result.lastInsertRowid as number;
  });

  const listingId = createTx();
  const listing = formatListing(getListingRow(listingId));
  res.status(201).json(listing);
});

router.delete("/marketplace/:listingId", (req, res) => {
  const listingId = parseInt(req.params.listingId ?? "0", 10);
  const listing = db
    .prepare("SELECT id, seller_id, owned_creature_id FROM marketplace_listings WHERE id = ? AND active = 1")
    .get(listingId) as { id: number; seller_id: number; owned_creature_id: number } | undefined;

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.seller_id !== CURRENT_USER_ID) { res.status(403).json({ error: "Not your listing" }); return; }

  const cancelTx = db.transaction(() => {
    db.prepare("UPDATE marketplace_listings SET active = 0 WHERE id = ?").run(listingId);
    db.prepare("UPDATE owned_creatures SET listed_for_sale = 0 WHERE id = ?").run(listing.owned_creature_id);
  });
  cancelTx();
  res.json({ success: true });
});

router.post("/marketplace/:listingId/buy", (req, res) => {
  const listingId = parseInt(req.params.listingId ?? "0", 10);
  const listing = db
    .prepare("SELECT id, seller_id, owned_creature_id, price FROM marketplace_listings WHERE id = ? AND active = 1")
    .get(listingId) as { id: number; seller_id: number; owned_creature_id: number; price: number } | undefined;

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (listing.seller_id === CURRENT_USER_ID) { res.status(400).json({ error: "Cannot buy your own listing" }); return; }

  const buyer = db.prepare("SELECT coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as { coins: number } | undefined;
  if (!buyer) { res.status(404).json({ error: "Buyer not found" }); return; }
  if (buyer.coins < listing.price) {
    res.status(400).json({ error: `Not enough coins. Need ${listing.price}.` });
    return;
  }

  const buyTx = db.transaction(() => {
    db.prepare("UPDATE users SET coins = coins - ? WHERE id = ?").run(listing.price, CURRENT_USER_ID);
    db.prepare("UPDATE users SET coins = coins + ? WHERE id = ?").run(listing.price, listing.seller_id);
    db.prepare("UPDATE marketplace_listings SET active = 0 WHERE id = ?").run(listingId);
    db.prepare("UPDATE owned_creatures SET user_id = ?, listed_for_sale = 0 WHERE id = ?").run(
      CURRENT_USER_ID,
      listing.owned_creature_id
    );
  });
  buyTx();

  const updatedBuyer = db.prepare("SELECT coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as { coins: number };
  const ownedCreature = db
    .prepare(
      `SELECT oc.id, oc.creature_id as creatureId, c.name, c.rarity, c.type,
              c.attack, c.defense, c.speed, c.health, c.power_score as powerScore,
              c.image_url as imageUrl, oc.acquired_at as acquiredAt, oc.listed_for_sale as listedForSale, oc.xp
       FROM owned_creatures oc
       JOIN creatures c ON c.id = oc.creature_id
       WHERE oc.id = ?`
    )
    .get(listing.owned_creature_id) as {
    id: number; creatureId: number; name: string; rarity: string; type: string;
    attack: number; defense: number; speed: number; health: number;
    powerScore: number; imageUrl: string; acquiredAt: string; listedForSale: number; xp: number;
  };

  res.json({
    creature: { ...ownedCreature, listedForSale: ownedCreature.listedForSale === 1 },
    coinsSpent: listing.price,
    coinsRemaining: updatedBuyer.coins,
  });
});

export default router;
