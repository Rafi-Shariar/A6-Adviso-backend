import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../utils/AppError";
import { IRegisterUser } from "./auth.interface";
import httpStatus from "http-status";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";
import config from "../../config";

const registerUserIntoDB = async (payload : IRegisterUser) => {

    const {name, timezone, password} = payload

    const email = payload.email.trim().toLocaleLowerCase()

    const isUserExits = await prisma.user.findUnique({
        where : {email}
    })

    if(isUserExits){
        throw new AppError(httpStatus.CONFLICT, "User with this email already exists.")
    }

    const hashedPassword = await bcrypt.hash(password, 10)


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

export const AuthServices = {
    registerUserIntoDB
};
