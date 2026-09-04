import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { PaymentController } from "./payment.controller";

const router = Router();

router.get("/my-payments", auth(Role.USER), PaymentController.getMyPayments);
router.get(
	"/my-payments/:paymentId",
	auth(Role.USER),
	PaymentController.getMyPaymentDetails,
);

router.get(
	"/admin/all-payments",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	PaymentController.getAllPayments,
);
router.get(
	"/admin/all-payments/:paymentId",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	PaymentController.getPaymentDetailsAdmin,
);

export const PaymentRoutes = router;
