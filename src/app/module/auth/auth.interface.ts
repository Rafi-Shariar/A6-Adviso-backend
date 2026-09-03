import { Role } from "../../../generated/prisma/enums";

export interface IRegisterUser {
	name: string;
	email: string;
	timezone: string;
	password: string;
}

export interface IVerifyEmailPayload {
	otp: string;
	email: string;
}

export interface ILoginUserPayload {
	email: string;
	password: string;
}

export interface IResetPasswordPayload {
	email: string;
	password: string;
	otp: string;
}

export interface IRequestUser {
	userId: string;
	email: string;
	name: string;
	role: Role;
}

export interface IGoogleLoginPayload {
	idToken: string;
	timezone: string;
}
