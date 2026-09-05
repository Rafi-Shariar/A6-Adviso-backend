import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthValidation } from "./auth.validation";
import { AuthController } from "./auth.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { authLimiter } from "../../utils/limiters";

const router = Router();

router.post(
	"/register",
	authLimiter,
	validateRequest(AuthValidation.registerZodSchema),
	AuthController.registerUser,
);

router.post(
	"/verify-email",
	validateRequest(AuthValidation.EmailVerifyZodSchema),
	AuthController.verifyEmail,
);

router.post(
	"/login",
	authLimiter,
	validateRequest(AuthValidation.LoginZodSchema),
	AuthController.loginUser,
);

router.post("/google", AuthController.googleLogin);

router.post("/refresh-token",authLimiter, AuthController.refreshToken);

router.post("/forgot-password",authLimiter, AuthController.forgotPassword);

router.post(
	"/reset-password",
	authLimiter,
	validateRequest(AuthValidation.ResetPasswordZodSchema),
	AuthController.resetPassword,
);

router.get(
	"/me",
	auth(Role.ADMIN, Role.MENTOR, Role.SUPER_ADMIN, Role.USER),
	AuthController.getMe,
);

export const AuthRoutes = router;
