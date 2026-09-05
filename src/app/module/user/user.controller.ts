import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { UserServices } from "./user.service";

const uploadProfileImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "No File Provided.");
	}

	const userId = req.user?.userId;

	const result = await UserServices.uploadProfileImage(
		req.file?.buffer,
		userId!,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Profile Picture Uploaded",
		data: result,
	});
});

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await UserServices.getAllUser(user, req.query);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "All users fetched",
		data: result,
	});
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const userId = req.params.userId as string;

	await UserServices.DeleteUser(userId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User deleted successfully.",
		data: null,
	});
});

const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const userId = req.params.userId as string;
	const { status } = req.body;

	const result = await UserServices.updateUserStatus(userId, status, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "User account status updated successfully.",
		data: result,
	});
});

export const UserController = {
	uploadProfileImage,
	getAllUsers,
	deleteUser,
	updateUserStatus,
};
