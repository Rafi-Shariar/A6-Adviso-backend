import cookieParser from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express, {
	type Application,
	NextFunction,
	type Request,
	type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import { MentorRoutes } from "./app/module/mentor/mentor.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { SessionRoutes } from "./app/module/session/session.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { ReviewRoutes } from "./app/module/review/review.route";
import { UserRoutes } from "./app/module/user/user.route";

const app: Application = express();

app.use(
	cors({
		origin: config.frontend_url,
		credentials: true,
	}),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

//routes
app.use("/api/v1/auth", AuthRoutes);
app.use("/api/v1/mentor", MentorRoutes);
app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/session", SessionRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/review", ReviewRoutes);
app.use("/api/v1/user", UserRoutes);

// Basic route
app.get("/", async (req: Request, res: Response) => {
	res.status(httpStatus.OK).json({
		success: true,
		message: "Welcome to Adviso Backend",
	});
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
