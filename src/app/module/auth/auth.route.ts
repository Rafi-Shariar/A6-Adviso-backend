import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthValidation } from "./auth.validation";
import { AuthController } from "./auth.controller";

const router = Router();

router.post(
	"/register",
	validateRequest(AuthValidation.registerZodSchema),
	AuthController.registerUser,
);

router.post('/verify-email', validateRequest(AuthValidation.EmailVerifyZodSchema), AuthController.verifyEmail)

router.post('/login', validateRequest(AuthValidation.LoginZodSchema), AuthController.loginUser)

router.post('/refresh-token', AuthController.refreshToken)

export const AuthRoutes = router;
