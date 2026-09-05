import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { SessionController } from "./session.controller";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { authLimiter } from "../../utils/limiters";

const router = Router();

router.get("/slots/:mentorId", SessionController.getMentorAvailableSlots);
router.post("/book",  auth(Role.USER), SessionController.bookSession);
router.post("/pay-session", authLimiter, auth(Role.USER), SessionController.paySession);
router.get("/book/payment/callback", SessionController.bookSessionCallback);
router.post("/cancel", auth(Role.USER), SessionController.cancelSesionByUser);
router.get("/my-sessions", auth(Role.USER), SessionController.getMySessionUser);
router.get(
	"/my-sessions/:sessionId",
	auth(Role.USER),
	SessionController.getMySessionDetailsUser,
);
router.get(
	"/mentor-sessions",
	auth(Role.MENTOR),
	SessionController.getMySessionMentor,
);
router.get(
	"/mentor-sessions/:sessionId",
	auth(Role.MENTOR),
	SessionController.getMySessionDetailsMentor,
);

router.patch(
	"/mark-complete",
	auth(Role.MENTOR),
	SessionController.completeSession,
);

router.get(
	"/admin/all-sessions",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	SessionController.getAllSessionForAdmin,
);
router.get(
	"/admin/all-sessions/:sessionId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	SessionController.getSessionDetailsAdmin,
);

export const SessionRoutes = router;
