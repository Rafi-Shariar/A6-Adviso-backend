import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import { IRequestUser } from "../auth/auth.interface";
import { AccountStatus, Role } from "../../../generated/prisma/enums";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";
import { calculatePagination } from "../../../helper/paginationHelper";
import { buildPrismaWhereConditions } from "../../../helper/queryBuilder";

const uploadProfileImage = async (buffer: Buffer, userId: string) => {
	const currentUser = await prisma.user.findUnique({
		where: {
			userId: userId,
		},
		select: {
			imagePublicId: true,
			profileURL: true,
		},
	});

	const cloudinaryResult = await new Promise<UploadApiResponse>(
		(resolve, reject) => {
			cloudinary.uploader
				.upload_stream(
					{
						resource_type: "auto",
					},

					async (error, result) => {
						if (error) {
							return reject(error);
						}

						if (!result) {
							return reject(new Error("No result returned from Cloudinary"));
						}

						resolve(result);
					},
				)
				.end(buffer);
		},
	);

	const updatedUser = await prisma.user.update({
		where: {
			userId: userId,
		},

		data: {
			profileURL: cloudinaryResult.secure_url,
			imagePublicId: cloudinaryResult.public_id,
		},

		omit: {
			password: true,
		},
	});

	if (currentUser?.imagePublicId && currentUser.profileURL) {
		await cloudinary.uploader.destroy(currentUser.imagePublicId);
	}

	return updatedUser;
};

const getAllUser = async (user: IRequestUser, query: Record<string, any>) => {
	const isAuthorized =
		user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN;

	if (!isAuthorized) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied. Admin and Super Admin only.",
		);
	}

	const { page, limit, skip, sortBy, sortOrder } = calculatePagination(query);

	const searchOn = ["name", "email"];

	const whereConditions = buildPrismaWhereConditions({
		query,
		searchableFields: searchOn,
		baseConditions: [{ isDeleted: false }],
	});

	const [users, total] = await Promise.all([
		prisma.user.findMany({
			where: whereConditions,
			skip,
			take: limit,
			orderBy: {
				[sortBy]: sortOrder,
			},
			omit: {
				password: true,
			},
		}),

		prisma.user.count({
			where: whereConditions,
		}),
	]);

	return {
		meta: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
		data: users,
	};
};

const DeleteUser = async (userId: string, adminUser: IRequestUser) => {
	const isAuthorized =
		adminUser.role === Role.ADMIN || adminUser.role === Role.SUPER_ADMIN;

	if (!isAuthorized) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied. Admin and Super Admin only.",
		);
	}

	if (userId === adminUser.userId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You cannot delete your own account.",
		);
	}

	const existingUser = await prisma.user.findUnique({
		where: {
			userId: userId,
		},
	});

	if (!existingUser || existingUser.isDeleted) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User not found or already deleted.",
		);
	}

	if (
		existingUser.role === Role.SUPER_ADMIN &&
		adminUser.role !== Role.SUPER_ADMIN
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only Super Admins can delete a Super Admin account.",
		);
	}

	const deletedUser = await prisma.user.update({
		where: {
			userId: userId,
		},
		data: {
			isDeleted: true,
			accountStatus: AccountStatus.SUSPENDED,
		},
		omit: {
			password: true,
		},
	});

	return deletedUser;
};

export const updateUserStatus = async (
	userId: string,
	status: AccountStatus,
	adminUser: IRequestUser,
) => {
	const isAuthorized =
		adminUser.role === Role.ADMIN || adminUser.role === Role.SUPER_ADMIN;

	if (!isAuthorized) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Access denied. Admin and Super Admin only.",
		);
	}

	if (!Object.values(AccountStatus).includes(status)) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			`Invalid status. Valid options are: ${Object.values(AccountStatus).join(", ")}`,
		);
	}

	if (userId === adminUser.userId) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"You cannot modify your own account status.",
		);
	}

	const existingUser = await prisma.user.findUnique({
		where: {
			userId,
		},
	});

	if (!existingUser || existingUser.isDeleted) {
		throw new AppError(
			httpStatus.NOT_FOUND,
			"User not found or has been deleted.",
		);
	}

	if (
		existingUser.role === Role.SUPER_ADMIN &&
		adminUser.role !== Role.SUPER_ADMIN
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			"Only Super Admins can change status of a Super Admin.",
		);
	}

	const updatedUser = await prisma.user.update({
		where: {
			userId,
		},
		data: {
			accountStatus: status,
		},
		omit: {
			password: true,
		},
	});

	return updatedUser;
};

export const UserServices = {
	uploadProfileImage,
	getAllUser,
	DeleteUser,
	updateUserStatus,
};
