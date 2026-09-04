import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AnalyticsServices } from "./analytics.service";

const getPlatformAnalytics = catchAsync(async (req: Request, res: Response) => {
	const result = await AnalyticsServices.getPlatformAnalytics();
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Platform analytics retrieved",
		data: result,
	});
});

const getUserDashboardAnalytics = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;

		const result = await AnalyticsServices.getUserDashboardAnalytics(user);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "User analytics retrieved",
			data: result,
		});
	},
);

const getMentorDashboardAnalytics = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;

		const result = await AnalyticsServices.getMentorDashboardAnalytics(user);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Mentor analytics retrieved",
			data: result,
		});
	},
);

const getAdminDashboardAnalytics = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;

		const result = await AnalyticsServices.getAdminDashboardAnalytics(user);
		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Admin analytics retrieved",
			data: result,
		});
	},
);
export const AnalyticsController = {
	getPlatformAnalytics,
	getUserDashboardAnalytics,
	getMentorDashboardAnalytics,
	getAdminDashboardAnalytics,
};
