import z, { email } from "zod";

const passwordValidation = z
	.string({ message: "Password is required" })
	.min(8, "Password must be at least 8 characters long")
	.regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
	.regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
	.regex(/[0-9]/, "Password must contain at least 1 number")
	.regex(/[^A-Za-z0-9]/, "Password must contain at least 1 special character");

const registerZodSchema = z.object({
	name: z
		.string({ message: "Name is required" })
		.trim()
		.min(2, "Name must be at least 2 characters long")
		.max(100, "Name cannot exceed 100 characters"),
	email: z
		.string({ message: "Email is required" })
		.trim()
		.toLowerCase()
		.email("Invalid email address"),
	password: passwordValidation,
	timezone: z
		.string()
		.optional()
		.default("UTC")
		.refine(
			(tz) => {
				try {
					Intl.DateTimeFormat(undefined, { timeZone: tz });
					return true;
				} catch {
					return false;
				}
			},
			{ message: "Invalid IANA timezone identifier" },
		),
});

const EmailVerifyZodSchema = z.object({
	email: z.email("Not email!!"),
	otp: z.string().length(6),
});

const LoginZodSchema = z.object({
	email: z.email("Not email!!"),
	password: passwordValidation,
});

export const AuthValidation = {
	registerZodSchema,
	EmailVerifyZodSchema,
	LoginZodSchema,
};
