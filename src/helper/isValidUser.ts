import httpStatus from "http-status";
import { AccountStatus, User } from "../generated/prisma/client";
import { prisma } from "../app/lib/prisma";
import { AppError } from "../app/utils/AppError";

export const getActiveUserByEmailOrThrow = async (
	email: string,
): Promise<User> => {
	const normalizedEmail = email.trim().toLowerCase();

	const user = await prisma.user.findUnique({
		where: { email: normalizedEmail },
	});

	if (!user) {
		throw new AppError(httpStatus.NOT_FOUND, "User Not Found");
	}

	if (user.isDeleted) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is deleted");
	}

	if (user.accountStatus === AccountStatus.BLOCKED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is blocked");
	}

	if (user.accountStatus === AccountStatus.SUSPENDED) {
		throw new AppError(httpStatus.FORBIDDEN, "User account is suspended");
	}

	return user;
};
