import z from "zod";

const addReviewValidationSchema = z.object({
	sessionId: z
		.string({ message: "Session ID is required" })
		.uuid({ message: "Invalid session ID format" }),

	ratings: z
		.number({ message: "Ratings is required and must be a number" })
		.min(1, { message: "Ratings must be at least 1" })
		.max(5, { message: "Ratings cannot exceed 5" }),

	review: z
		.string({ message: "Review is required" })
		.trim()
		.min(5, { message: "Review must be at least 5 characters long" })
		.max(1000, { message: "Review cannot exceed 1000 characters" }),
});

export const ReviewValidation = {
	addReviewValidationSchema,
};
