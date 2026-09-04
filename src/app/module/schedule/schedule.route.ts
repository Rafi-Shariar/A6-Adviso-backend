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

router.delete("/delete", auth(Role.MENTOR), ScheduleController.deleteSchedule);

router.get(
	"/my-schedules",
	auth(Role.MENTOR),
	ScheduleController.getMentorSchedules,
);
router.get(
	"/admin/all-schedules",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	ScheduleController.getAllSchedulesForAdmin,
);

export const ScheduleRoutes = router;
