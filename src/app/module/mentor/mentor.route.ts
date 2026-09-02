import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

//validateRequest(UserValidation.PatientEmailVerifyZodSchema) for Zod Validation

export const AuthRoutes = router;
