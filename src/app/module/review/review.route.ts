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

router.get("/my-reviews", auth(Role.USER), ReviewController.getMyReviews);
router.get(
	"/mentor-reviews",
	auth(Role.USER),
	ReviewController.getMyReviewsMentor,
);
router.get(
	"/admin/all-reviews",
	auth(Role.USER),
	ReviewController.getAllReviewsAdmin,
);

export const ReviewRoutes = router;
