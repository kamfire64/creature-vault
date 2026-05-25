import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import usersRouter from "./users.js";
import creaturesRouter from "./creatures.js";
import packsRouter from "./packs.js";
import marketplaceRouter from "./marketplace.js";
import battlesRouter from "./battles.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(creaturesRouter);
router.use(packsRouter);
router.use(marketplaceRouter);
router.use(battlesRouter);

export default router;
