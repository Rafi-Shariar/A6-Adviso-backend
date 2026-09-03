import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { SessionServices } from "./session.service";

const getMentorAvailableSlots = catchAsync(
	async (req: Request, res: Response) => {
		const { mentorId } = req.params;

		const result = await SessionServices.getMentorAvailableSlots(
			mentorId as string,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Available slots retrieved successfully",
			data: result,
		});
	},
);

const bookSession = catchAsync(async (req: Request, res: Response) => {
	const { slotId, purpose } = req.body;
	const user = req.user!;

	const result = await SessionServices.bookSession(slotId, user, purpose);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message:
			"Session Booked. Payment initiated. Please pay to confirm session.",
		data: result,
	});
});

export const SessionController = {
	getMentorAvailableSlots,
	bookSession,
};
