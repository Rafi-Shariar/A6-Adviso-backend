import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { AuthValidation } from "./auth.validation";
import { AuthController } from "./auth.controller";

const router = Router();

router.post('/register', validateRequest(AuthValidation.registerSchema), AuthController.registerUser)

export const AuthRoutes = router;
