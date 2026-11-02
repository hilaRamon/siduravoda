import express from "express";
import { attachUser, requireAuth } from "../middleware/auth.js";
import * as authController from "../controllers/authController.js";

const router = express.Router();

router.use(attachUser);

router.get("/login-emails", authController.loginEmails);
router.post("/auto-login", authController.autoLoginHandler);
router.get("/google-client-id", authController.googleClientIdHandler);
router.post("/google", authController.google);
router.post("/remembered-session", authController.rememberedSessionHandler);
router.post("/login", authController.loginHandler);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.get("/users", requireAuth, authController.listUsersHandler);
router.post("/invite", requireAuth, authController.invite);
router.patch("/users/:id/password", requireAuth, authController.setUserPasswordHandler);
router.patch("/users/:id", requireAuth, authController.updateUserHandler);
router.delete("/users/:id", requireAuth, authController.deleteUserHandler);
router.patch("/me/password", requireAuth, authController.changePasswordHandler);
router.patch("/me", requireAuth, authController.updateMeHandler);

export default router;
