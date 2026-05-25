import { Router, type IRouter } from "express";
import { db } from "../db.js";

const router: IRouter = Router();

const CURRENT_USER_ID = 1;

router.get("/users/me", (_req, res) => {
  const user = db.prepare("SELECT id, username, coins FROM users WHERE id = ?").get(CURRENT_USER_ID) as
    | { id: number; username: string; coins: number }
    | undefined;
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

export default router;
