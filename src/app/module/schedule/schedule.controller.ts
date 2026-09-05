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

const getMentorSchedules = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await ScheduleServices.getMySchedulesMentor(user, req.query);

	sendResponse(res, {
		statusCode: httpStatus.CREATED,
		success: true,
		message: "Schedules retireved successfully.",
		data: result,
	});
});

const getAllSchedulesForAdmin = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;

		const result = await ScheduleServices.getAllSchedulesForAdmin(
			user,
			req.query,
		);

		sendResponse(res, {
			statusCode: httpStatus.CREATED,
			success: true,
			message: "Schedules retireved successfully.",
			data: result,
		});
	},
);

const deleteSchedule = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const { scheduleId } = req.body;

	const result = await ScheduleServices.deleteScheduleMentor(user, scheduleId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Deleted Schedule.",
		data: result,
	});
});
export const ScheduleController = {
	createSchedule,
	getMentorSchedules,
	getAllSchedulesForAdmin,
	deleteSchedule,
};
