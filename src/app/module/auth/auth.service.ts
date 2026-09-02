import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import {
	ILoginUserPayload,
	IRegisterUser,
	IResetPasswordPayload,
	IVerifyEmailPayload,
} from "./auth.interface";
import httpStatus from "http-status";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";
import {
	AccountStatus,
	AuthProvider,
	Role,
} from "../../../generated/prisma/enums";
import { ILoginUserPayloadExample } from "../example/example.interface";
import { jwtUtils } from "../../utils/jwt";
import { JwtPayload, SignOptions } from "jsonwebtoken";
import { getActiveUserByEmailOrThrow } from "../../../helper/isValidUser";

const registerUserIntoDB = async (payload: IRegisterUser) => {
	const { name, timezone, password } = payload;

	const email = payload.email.trim().toLocaleLowerCase();

	const isUserExits = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExits) {
		throw new AppError(
			httpStatus.CONFLICT,
			"User with this email already exists.",
		);
	}

	const hashedPassword = await bcrypt.hash(password, 10);

	//OTP in redis
	const expirationSeconds = 5 * 60;
	const otpKey = `user-registration-otp:${email}`;
	const otpValue = crypto.randomInt(100000, 1000000).toString();

	await redisClient.set(otpKey, otpValue, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	//User Data in Redis
	const userRegistrationKey = `user-registration-data:${email}`;
	const redisUserDataPayload = {
		name,
		email,
		timezone,
		password: hashedPassword,
	};

	await redisClient.set(
		userRegistrationKey,
		JSON.stringify(redisUserDataPayload),
		{
			expiration: {
				type: "EX",
				value: expirationSeconds,
			},
		},
	);

	//sending Email
	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/verify-email.ejs",
	);

	const templateData = {
		name,
		email,
		otp: otpValue,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Adviso - Email Verification",
		html,
	});
};

const verifyUserEmail = async (payload: IVerifyEmailPayload) => {
	const otp = payload.otp;
	const email = payload.email.trim().toLowerCase();

	const isUserExist = await prisma.user.findUnique({
		where: { email },
	});

	if (isUserExist?.accountStatus === "BLOCKED") {
		throw new AppError(httpStatus.FORBIDDEN, "User is Blocked");
	}

	if (isUserExist?.isEmailVerified) {
		throw new AppError(httpStatus.CONFLICT, "Email ALready Verified");
	}

	if (
		isUserExist?.isDeleted ||
		isUserExist?.accountStatus === AccountStatus.SUSPENDED
	) {
		throw new AppError(
			httpStatus.FORBIDDEN,
			`User is ${isUserExist.accountStatus}`,
		);
	}

	const otpKey = `user-registration-otp:${email}`;

	const redisOtp = await redisClient.get(otpKey);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	await redisClient.del(otpKey);

	const userRegistrationKey = `user-registration-data:${email}`;

	const redisPatientData = await redisClient.get(userRegistrationKey);

	if (!redisPatientData) {
		throw new AppError(httpStatus.NOT_FOUND, "Patient Doesn't Exist");
	}

	const userPayload: IRegisterUser = JSON.parse(redisPatientData);

	const createdUser = await prisma.user.create({
		data: {
			name: userPayload.name,
			email: userPayload.email,
			timezone: userPayload.timezone,
			password: userPayload.password,
			isEmailVerified: true,
			role: Role.USER,
		},
		omit: {
			password: true,
		},
	});

	await redisClient.del(userRegistrationKey);

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/welcome-email.ejs",
	);

	const templateData = {
		name: createdUser.name,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: email,
		subject: "Welcome To ADVISO",
		html,
	});

	const jwtPayload = {
		userId: createdUser.userId,
		name: createdUser.name,
		email: createdUser.email,
		role: createdUser.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		data: createdUser,
		accessToken,
		refreshToken,
	};
};

const loginUser = async (payload: ILoginUserPayload) => {
	const { password } = payload;
	const email = payload.email.trim().toLowerCase();

	const user = await getActiveUserByEmailOrThrow(email);

	if (user.password === null && user.googleId !== null) {
		throw new AppError(
			httpStatus.BAD_REQUEST,
			"User Already Has Account Registered With Google. Try To Login With Google.",
		);
	}

	const isPasswordMatched = await bcrypt.compare(
		password,
		user.password as string,
	);

	if (!isPasswordMatched) {
		throw new AppError(httpStatus.UNAUTHORIZED, "Invalid credentials");
	}

	const jwtPayload = {
		userId: user.userId,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const refreshToken = async (token: string) => {
	const verifiedRefreshToken = jwtUtils.verifyToken(
		token,
		config.jwt_refresh_secret,
	);

	if (!verifiedRefreshToken.success || !verifiedRefreshToken.data) {
		throw new AppError(
			httpStatus.UNAUTHORIZED,
			config.node_env === "development"
				? verifiedRefreshToken.error
				: "Invalid refresh token",
		);
	}

	const data = verifiedRefreshToken.data as JwtPayload;

	const user = await getActiveUserByEmailOrThrow(data.email);

	const jwtPayload = {
		userId: user.userId,
		name: user.name,
		email: user.email,
		role: user.role,
	};

	const accessToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_access_secret,
		config.jwt_access_expires_in as SignOptions,
	);

	const refreshToken = jwtUtils.createToken(
		jwtPayload,
		config.jwt_refresh_secret,
		config.jwt_refresh_expires_in as SignOptions,
	);

	return {
		accessToken,
		refreshToken,
	};
};

const forgotPassword = async (email: string) => {
	const user = await getActiveUserByEmailOrThrow(email);

	if (user.googleId && user.authProvider === AuthProvider.GOOGLE) {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const otp = crypto.randomInt(100000, 1000000).toString();

	const key = `forgor-password-otp:${user.email}`;

	const expirationSeconds = 5 * 60;

	await redisClient.set(key, otp, {
		expiration: {
			type: "EX",
			value: expirationSeconds,
		},
	});

	const tempatePath = path.join(
		process.cwd(),
		"src/app/templates/forgot-password-otp.ejs",
	);

	const templateData = {
		name: user.name,
		otp,
	};

	const html = await ejs.renderFile(tempatePath, templateData);

	await transporter.sendMail({
		from: config.email_sender,
		to: user.email,
		subject: "Forgot Password",
		html,
	});
};

const resetPassword = async (payload: IResetPasswordPayload) => {
	const { email, otp, password } = payload;

	const user = await getActiveUserByEmailOrThrow(email);

	if (user.googleId && user.authProvider === "GOOGLE") {
		throw new AppError(httpStatus.BAD_REQUEST, "User Has Account With Google");
	}

	const key = `forgor-password-otp:${user.email}`;

	const redisOtp = await redisClient.get(key);

	if (!redisOtp) {
		throw new AppError(httpStatus.BAD_REQUEST, "Invalid OTP");
	}

	if (redisOtp !== otp) {
		throw new AppError(httpStatus.BAD_REQUEST, "OTP Does Not Match");
	}

	const hashedNewPassword = await bcrypt.hash(password, 10);

	await prisma.user.update({
		where: {
			email: user.email,
		},
		data: {
			password: hashedNewPassword,
		},
	});

	await redisClient.del([key]);
};
export const AuthServices = {
	registerUserIntoDB,
	verifyUserEmail,
	loginUser,
	refreshToken,
	forgotPassword,
	resetPassword,
};
