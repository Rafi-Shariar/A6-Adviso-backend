import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { SessionController } from "./session.controller";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";

const router = Router();

router.get("/slots/:mentorId", SessionController.getMentorAvailableSlots);
router.post("/book", auth(Role.USER), SessionController.bookSession);
router.get("/book/payment/callback", SessionController.bookAppointmentCallback);

export const SessionRoutes = router;
