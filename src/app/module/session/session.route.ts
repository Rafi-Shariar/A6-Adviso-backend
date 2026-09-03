import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { SessionController } from "./session.controller";

const router = Router();

router.get("/slots/:mentorId", SessionController.getMentorAvailableSlots);

export const SessionRoutes = router;
