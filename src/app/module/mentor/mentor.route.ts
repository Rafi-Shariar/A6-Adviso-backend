import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { upload } from "../../lib/multer";
import { MentorController } from "./mentor.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post(
	"/apply",
	upload.fields([
		{ name: "resume", maxCount: 1 },
		{ name: "documents", maxCount: 5 },
	]),
	auth(Role.USER),
	MentorController.ApplyAsMentor,
);

export const MentorRoutes = router;
