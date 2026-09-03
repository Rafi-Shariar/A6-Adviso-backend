import type { Request, Response } from "express";
import httpStatus from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ScheduleServices } from "./schedule.service";

const createSchedule = catchAsync(async (req: Request, res: Response) => {
	const mentorId = req.user?.userId as string;

	const result = await ScheduleServices.createSchedule(mentorId, req.body);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Schedule slot created successfully.",
		data: result,
	});
});

export const ScheduleController = {
	createSchedule,
};
