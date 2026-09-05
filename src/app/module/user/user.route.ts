import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { UserController } from "./user.controller";

const router = Router();

router.patch(
	"/profile-image",
	auth(Role.SUPER_ADMIN, Role.ADMIN, Role.USER, Role.MENTOR),
	upload.single("profileImage"),
	UserController.uploadProfileImage,
);

router.get(
	"/admin/all-user",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	UserController.getAllUsers,
);

router.delete(
	"/admin/delete-user/:userId",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	UserController.deleteUser,
);

router.patch(
	"/admin/update-status/:userId",
	auth(Role.SUPER_ADMIN, Role.ADMIN),
	UserController.updateUserStatus,
);
export const UserRoutes = router;
