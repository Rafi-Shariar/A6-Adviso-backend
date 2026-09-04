import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { SessionController } from "./session.controller";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";

const router = Router();

router.get("/slots/:mentorId", SessionController.getMentorAvailableSlots);
router.post("/book", auth(Role.USER), SessionController.bookSession);
router.get("/book/payment/callback", SessionController.bookAppointmentCallback);
router.get("/my-sessions", auth(Role.USER), SessionController.getMySessionUser);
router.get("/my-sessions/:sessionId", auth(Role.USER), SessionController.getMySessionDetailsUser);

export const SessionRoutes = router;
