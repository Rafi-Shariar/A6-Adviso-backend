import type { Request, Response } from "express";
import httpStatus from "http-status";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { BlogServices } from "./blog.service";

const uploadBlog = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await BlogServices.uploadBlog(user, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog uploaded successfully",
		data: result,
	});
});

const updateBlog = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const blogId = req.params.blogId as string;

	const result = await BlogServices.updateBlog(blogId, user, req.body);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog updated successfully",
		data: result,
	});
});

const allBlogsForUser = catchAsync(async (req: Request, res: Response) => {
	

	const result = await BlogServices.allBlogsForUser();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blogs retrieved successfully",
		data: result,
	});
});

const deleteBlog = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;
	const blogId = req.params.blogId as string;

	const result = await BlogServices.deleteBlog(blogId, user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog deleted successfully",
		data: null,
	});
});

const blogDetails = catchAsync(async (req: Request, res: Response) => {
	const blogId = req.params.blogId as string;

	const result = await BlogServices.blogDetails(blogId);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog details retrieved successfully",
		data: result,
	});
});

const homepageBlogs = catchAsync(async (req: Request, res: Response) => {
	const result = await BlogServices.homepageBlogs();

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog updated successfully",
		data: result,
	});
});

const myBlogs = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await BlogServices.myBlogs(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My blogs retrieved successfully",
		data: result,
	});
});

const allBlogsForAdmin = catchAsync(async (req: Request, res: Response) => {
	const user = req.user!;

	const result = await BlogServices.allBlogsForAdmin(user);

	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "My blogs retrieved successfully",
		data: result,
	});
});

const uploadBannerImage = catchAsync(async (req: Request, res: Response) => {
	if (!req.file) {
		throw new AppError(httpStatus.BAD_REQUEST, "Banner Image Missing");
	}

	const user = req.user!;
	const blogId = req.params.blogId as string;

	const result = await BlogServices.uploadBlogBannerImage(
		req.file?.buffer,
		blogId,
		user,
	);
	sendResponse(res, {
		statusCode: httpStatus.OK,
		success: true,
		message: "Blog Banner Picture Uploaded",
		data: result,
	});
});
export const BlogController = {
	uploadBlog,
	updateBlog,
	deleteBlog,
	homepageBlogs,
	blogDetails,
	myBlogs,
	allBlogsForAdmin,
	uploadBannerImage,
	allBlogsForUser
};
