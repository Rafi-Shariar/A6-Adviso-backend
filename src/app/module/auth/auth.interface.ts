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
