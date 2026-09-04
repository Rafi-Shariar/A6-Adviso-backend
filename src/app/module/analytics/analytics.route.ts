import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { AnalyticsController } from "./analytics.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

//validateRequest(UserValidation.PatientEmailVerifyZodSchema) for Zod Validation

router.get("/", AnalyticsController.getPlatformAnalytics);
router.get(
	"/user",
	auth(Role.USER),
	AnalyticsController.getUserDashboardAnalytics,
);
router.get(
	"/mentor",
	auth(Role.MENTOR),
	AnalyticsController.getMentorDashboardAnalytics,
);
router.get(
	"/admin",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	AnalyticsController.getAdminDashboardAnalytics,
);

export const AnalyticsRoutes = router;
