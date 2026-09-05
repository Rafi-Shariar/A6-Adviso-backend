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

const paySession = catchAsync(async (req: Request, res: Response) => {
	const { sessionId } = req.body;
	const user = req.user!;

	const result = await SessionServices.paySession(sessionId, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Session Payment Initiated Successfully",
		data: result,
	});
});

const bookSessionCallback = catchAsync(async (req: Request, res: Response) => {
	const { redirectURL } = await SessionServices.bookSessionCallback(req.query);

	res.redirect(redirectURL);
});

const cancelSesionByUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	const user = req.user!;

	const result = await SessionServices.cancelSessionByUser(payload, user);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Session Cancelled And Refunded Successfully",
		data: result,
	});
});

const getMySessionUser = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await SessionServices.getMySessionUser(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My sessions retrieved successfully.",
		data: result,
	});
});

const getMySessionDetailsUser = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;
		const sessionId = req.params.sessionId as string;

		const result = await SessionServices.getMySessionDetailsUser(
			user,
			sessionId,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Session details retrieved successfully.",
			data: result,
		});
	},
);

const getMySessionMentor = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await SessionServices.getMySessionsMentor(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My sessions retrieved successfully.",
		data: result,
	});
});

const getMySessionDetailsMentor = catchAsync(
	async (req: Request, res: Response) => {
		const user = req.user!;
		const sessionId = req.params.sessionId as string;

		const result = await SessionServices.getSessionDetailsMentor(
			user,
			sessionId,
		);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Session details retrieved successfully.",
			data: result,
		});
	},
);

const completeSession = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const payload = req.body;

	const result = await SessionServices.completeSession(user, payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Session marked as completed.",
		data: null,
	});
});
//For Admin
const getAllSessionForAdmin = catchAsync(
	async (req: Request, res: Response) => {
		const result = await SessionServices.getAllSessionForAdmin();

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "All sessions retrieved successfully",
			data: result,
		});
	},
);

const getSessionDetailsAdmin = catchAsync(
	async (req: Request, res: Response) => {
		const sessionId = req.params.sessionId as string;

		const result = await SessionServices.getSessionDetailsForAdmin(sessionId);

		sendResponse(res, {
			statusCode: httpStatus.OK,
			success: true,
			message: "Session details retrieved successfully.",
			data: result,
		});
	},
);

export const SessionController = {
	getMentorAvailableSlots,
	bookSession,
	paySession,
	bookSessionCallback,
	getMySessionUser,
	getMySessionDetailsUser,
	cancelSesionByUser,

	getMySessionMentor,
	getMySessionDetailsMentor,
	completeSession,

	getAllSessionForAdmin,
	getSessionDetailsAdmin,
};
