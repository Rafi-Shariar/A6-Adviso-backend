import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { AuthServices } from "./auth.service";

const registerUser = catchAsync(async (req: Request, res: Response) => {
	const payload = req.body;
	await AuthServices.registerUserIntoDB(payload);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Verification OTP send. Check your email",
		data: null,
	});
});

const verifyEmail = catchAsync(async (req: Request, res: Response) => {
	
	const result = await AuthServices.verifyUserEmail(req.body)

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Email verified successful. Welcome to ADVISO",
		data: result,
	});
});


export const AuthController = {
	registerUser,
	verifyEmail
};
