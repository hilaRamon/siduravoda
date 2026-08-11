import express from "express";
import { attachUser, requireAuth, requireAdmin } from "../middleware/auth.js";
import * as permissionRuleController from "../controllers/permissionRuleController.js";

const router = express.Router();

router.use(attachUser);
router.use(requireAuth);

router.get("/", permissionRuleController.list);
router.get("/by-role/:role", permissionRuleController.getByRole);
router.get("/:id", permissionRuleController.getById);
router.patch("/:id", requireAdmin, permissionRuleController.update);

export default router;
