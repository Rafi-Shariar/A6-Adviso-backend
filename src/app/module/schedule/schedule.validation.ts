import z from "zod";

export const createScheduleZodSchema = z.object({
	date: z
		.string({
			message: "Date is required",
		})
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
	startTime: z
		.string({
			message: "Start time is required",
		})
		.datetime({ message: "Start time must be a valid ISO datetime string" }),
	endTime: z
		.string({
			message: "End time is required",
		})
		.datetime({ message: "End time must be a valid ISO datetime string" }),
});

export const ScheduleValidation = {
	createScheduleZodSchema,
};
