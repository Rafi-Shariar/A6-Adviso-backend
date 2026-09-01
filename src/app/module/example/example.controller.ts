import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";



const example = catchAsync(async (req: Request, res: Response) => {
	

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Example Message",
		data: null,
	});
});



export const ExampleController = {
	
};
