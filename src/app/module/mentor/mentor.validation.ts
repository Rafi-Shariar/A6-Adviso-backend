import z from "zod";

const applyAsMentorZodSchema = z.object({
	headline: z
		.string({ message: "Headline is required" })
		.trim()
		.min(5, { message: "Headline must be at least 5 characters long" })
		.max(150, { message: "Headline cannot exceed 150 characters" }),

	bio: z
		.string({ message: "Bio is required" })
		.trim()
		.min(30, { message: "Bio must be at least 30 characters long" }),

	// Coerces string "5" -> number 5
	yearOfExperience: z.preprocess(
		(val) => (val !== undefined && val !== "" ? Number(val) : val),
		z
			.number({ message: "Years of experience is required" })
			.int({ message: "Years of experience must be an integer" })
			.min(0, { message: "Years of experience cannot be negative" })
			.max(100, { message: "Years of experience must be realistic" }),
	),

	// Handles both array ['React', 'Node'] and stringified/comma-separated form inputs
	expertiseTags: z.preprocess(
		(val) => {
			if (typeof val === "string") {
				try {
					const parsed = JSON.parse(val);
					if (Array.isArray(parsed)) return parsed;
				} catch {
					return val
						.split(",")
						.map((tag) => tag.trim())
						.filter(Boolean);
				}
			}
			return val;
		},
		z
			.array(z.string().trim().min(1, { message: "Tag cannot be empty" }))
			.min(1, { message: "Provide at least 1 expertise tag" }),
	),

	linkedinURL: z
		.string({ message: "LinkedIn profile URL is required" })
		.trim()
		.url({ message: "Invalid LinkedIn URL format" })
		.refine(
			(url) =>
				/^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/.test(url),
			{
				message:
					"Must be a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username)",
			},
		),

	professionalDomain: z
		.string({ message: "Professional domain is required" })
		.trim()
		.min(2, { message: "Domain name must be at least 2 characters long" }),

	portfolioURL: z
		.string()
		.trim()
		.url({ message: "Invalid portfolio URL format" })
		.optional()
		.or(z.literal("")),

	// Coerces string "50.00" -> number 50.00
	sessionCharge: z.preprocess(
		(val) => (val !== undefined && val !== "" ? Number(val) : val),
		z
			.number({ message: "Session charge is required" })
			.positive({ message: "Session charge must be greater than 0" }),
	),
});

export const MentorValidation = {
	applyAsMentorZodSchema,
};
