import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { AnalyticsController } from "./analytics.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

//validateRequest(UserValidation.PatientEmailVerifyZodSchema) for Zod Validation

router.get('/', AnalyticsController.getPlatformAnalytics)
router.get('/user', auth(Role.USER), AnalyticsController.getUserDashboardAnalytics)

export const AnalyticsRoutes = router;
