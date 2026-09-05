import httpStatus from "http-status";
import { IRequestUser } from "../auth/auth.interface";
import { IBlogPayload, IUpdateBlogPayload } from "./blog.interface";
import { Role } from "../../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import { prisma } from "../../lib/prisma";

import { cloudinary } from "../../lib/cloudinary";
import { UploadApiResponse } from "cloudinary";
import { calculatePagination } from "../../../helper/paginationHelper";
import { buildPrismaWhereConditions } from "../../../helper/queryBuilder";

export const uploadBlog = async (user: IRequestUser, payload: IBlogPayload) => {
	if (user.role !== Role.MENTOR) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Mentors only.");
	}

	const mentor = await prisma.mentor.findFirst({
		where: {
			mentorId: user.userId,
			isDeleted: false,
		},
	});

	if (!mentor) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only active mentors can publish blogs.",
		);
	}

	if (!payload?.title || !payload?.content) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Title and content are required.",
		);
	}

	const isTitleExist = await prisma.blog.findUnique({
		where: { title: payload.title },
	});

	if (isTitleExist) {
		throw new AppError(
			httpStatus.CONFLICT,
			"A blog with this title already exists.",
		);
	}

	const blog = await prisma.blog.create({
		data: {
			mentorId: user.userId,
			title: payload.title,
			content: payload.content,
			bannerImage: "https://placehold.co/1200x630?text=Blog+Banner",
			bannerImagePublicId: "placeholder",
		},
	});

	return blog;
};

export const updateBlog = async (
	blogId: string,
	user: IRequestUser,
	payload: IUpdateBlogPayload,
) => {
	if (user.role !== Role.MENTOR) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Mentors only.");
	}

	const existingBlog = await prisma.blog.findUnique({
		where: { blogId },
	});

	if (!existingBlog) {
		throw new AppError(httpStatus.NOT_FOUND, "Blog not found.");
	}

	if (existingBlog.mentorId !== user.userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to update this blog.",
		);
	}

	if (payload.title && payload.title !== existingBlog.title) {
		const isTitleExist = await prisma.blog.findUnique({
			where: { title: payload.title },
		});
		if (isTitleExist) {
			throw new AppError(
				httpStatus.CONFLICT,
				"A blog with this title already exists.",
			);
		}
	}

	const updatedBlog = await prisma.blog.update({
		where: { blogId },
		data: {
			title: payload.title,
			content: payload.content,
		},
	});

	return updatedBlog;
};

const allBlogsForUser = async (query: Record<string, any>) => {
	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);
	const searchOn = ["title", "content", "mentor.user.name"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
	});

	const [blogs, total] = await Promise.all([
		prisma.blog.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			include: {
				mentor: {
					select: {
						mentorId: true,
						headline: true,
						user: {
							select: {
								name: true,
								email: true,
								profileURL: true,
							},
						},
					},
				},
			},
		}),
		prisma.blog.count({
			where: whereConditions,
		}),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPage: Math.ceil(total / limit),
		},
		data: blogs,
	};
};

const deleteBlog = async (blogId: string, user: IRequestUser) => {
	const isAuthorized = user.role === Role.MENTOR || user.role === Role.ADMIN;
	if (!isAuthorized) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied.");
	}

	const existingBlog = await prisma.blog.findUnique({
		where: { blogId },
	});

	if (!existingBlog) {
		throw new AppError(httpStatus.NOT_FOUND, "Blog not found.");
	}

	if (user.role === Role.MENTOR && existingBlog.mentorId !== user.userId) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to delete this blog.",
		);
	}

	if (existingBlog?.bannerImage && existingBlog.bannerImagePublicId) {
		await cloudinary.uploader.destroy(existingBlog.bannerImagePublicId);
	}

	await prisma.blog.delete({
		where: { blogId },
	});
};

const homepageBlogs = async () => {
	const blogs = await prisma.blog.findMany({
		take: 4,
		orderBy: {
			createdAt: "desc",
		},
		select: {
			blogId: true,
			title: true,
			content: true,
			bannerImage: true,
			createdAt: true,
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							profileURL: true,
						},
					},
				},
			},
		},
	});

	return blogs;
};

const blogDetails = async (blogId: string) => {
	const blog = await prisma.blog.findUnique({
		where: { blogId },
		include: {
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							profileURL: true,
						},
					},
				},
			},
		},
	});

	if (!blog) {
		throw new AppError(httpStatus.NOT_FOUND, "Blog not found.");
	}

	return blog;
};

const myBlogs = async (user: IRequestUser) => {
	const mentor = await prisma.mentor.findFirst({
		where: {
			mentorId: user.userId,
			isDeleted: false,
		},
	});

	if (!mentor) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied. Only mentors can view their blogs.",
		);
	}

	const blogs = await prisma.blog.findMany({
		where: {
			mentorId: user.userId,
		},
		orderBy: {
			createdAt: "desc",
		},
		select: {
			blogId: true,
			title: true,
			content: true,
			bannerImage: true,
			createdAt: true,
			updatedAt: true,
		},
	});

	return blogs;
};

const allBlogsForAdmin = async (
	user: IRequestUser,
	query: Record<string, any>,
) => {
	const searchOn = ["title", "content", "mentor.user.name", "mentorId"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
	});

	const isAdminOrSuperAdmin =
		user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

	if (!isAdminOrSuperAdmin) {
		throw new AppError(httpStatus.FORBIDDEN, "Access denied. Admins only.");
	}

	const blogs = await prisma.blog.findMany({
		where: whereConditions,
		orderBy: {
			createdAt: "desc",
		},
		include: {
			mentor: {
				select: {
					mentorId: true,
					headline: true,
					user: {
						select: {
							name: true,
							email: true,
							profileURL: true,
						},
					},
				},
			},
		},
	});

	return blogs;
};

export const uploadBlogBannerImage = async (
	buffer: Buffer,
	blogId: string,
	user: IRequestUser,
) => {
	if (!buffer) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"Banner image buffer is required",
		);
	}

	const existingBlog = await prisma.blog.findUnique({
		where: {
			blogId: blogId,
		},
		select: {
			blogId: true,
			mentorId: true,
			bannerImage: true,
			bannerImagePublicId: true,
		},
	});

	if (!existingBlog) {
		throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
	}

	const isMentorOwner =
		user.role === Role.MENTOR && existingBlog.mentorId === user.userId;

	if (!isMentorOwner) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"You are not authorized to update this blog's banner",
		);
	}

	// ২. Cloudinary-তে নতুন ইমেজ আপলোড
	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						folder: "blogs",
						resource_type: "auto",
					},
					(error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(
								new AppError(
									httpStatus.INTERNAL_SERVER_ERROR,
									"No result returned from Cloudinary",
								),
							);
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedBlog = await prisma.blog.update({
		where: {
			blogId: blogId,
		},
		data: {
			bannerImage: cloudinaryResult.secure_url,
			bannerImagePublicId: cloudinaryResult.public_id,
		},
	});

	if (
		existingBlog.bannerImagePublicId &&
		existingBlog.bannerImagePublicId !== "placeholder"
	) {
		await cloudinary.uploader
			.destroy(existingBlog.bannerImagePublicId)
			.catch(() => null);
	}

	return updatedBlog;
};

export const BlogServices = {
	updateBlog,
	uploadBlog,
	deleteBlog,
	homepageBlogs,
	myBlogs,
	allBlogsForAdmin,
	blogDetails,
	uploadBlogBannerImage,
	allBlogsForUser,
};
