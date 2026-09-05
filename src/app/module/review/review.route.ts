import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { ReviewValidation } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = Router();

//validateRequest(UserValidation.PatientEmailVerifyZodSchema) for Zod Validation
router.post(
	"/add-review",
	auth(Role.USER),
	validateRequest(ReviewValidation.addReviewValidationSchema),
	ReviewController.addReview,
);

router.get("/", ReviewController.homepageReview);

export const ReviewRoutes = router;
