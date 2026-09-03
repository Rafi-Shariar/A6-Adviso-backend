import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { upload } from "../../lib/multer";
import { MentorController } from "./mentor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { MentorValidation } from "./mentor.validation";

const router = Router();

router.post(
	"/applications/apply",
	upload.fields([
		{ name: "resume", maxCount: 1 },
		{ name: "documents", maxCount: 5 },
	]),
	auth(Role.USER),
	MentorController.ApplyAsMentor,
);

router.post(
	"/applications/approve",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	MentorController.approveMentorApplications,
);
router.get("/featured", MentorController.getFeaturedMentors);
router.get("/", MentorController.getAllMentorsPublicList);
router.get("/:mentorId", MentorController.getSingleMentorPublicProfile);
router.patch(
	"/update-profile",
	auth(Role.MENTOR),
	validateRequest(MentorValidation.updateMentorProfileZodSchema),
	MentorController.updateMentorProfile,
);

//admin routes
router.get(
	"/admin/all-mentors",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	MentorController.getAllMentorsAdminList,
);
router.get(
	"/admin/all-mentors/:mentorId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	MentorController.getSingleMentorAdminProfile,
);
router.patch(
	"/admin/all-mentors/:mentorId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	MentorController.changeMentorshipStatus,
);

export const MentorRoutes = router;
