import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { ScheduleValidation } from "./schedule.validation";
import { ScheduleController } from "./schedule.controller";

const router = Router();

router.post(
	"/create",
	auth(Role.MENTOR),
	validateRequest(ScheduleValidation.createScheduleZodSchema),
	ScheduleController.createSchedule,
);

export const ScheduleRoutes = router;
