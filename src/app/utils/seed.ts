import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";

const mentorsData = [
	{
		email: "tahmid.rahman@example.com",
		name: "Tahmid Rahman",
		profileURL:
			"https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
		headline: "Lead Architect & Cloud Consultant",
		bio: "10+ years architecting fault-tolerant cloud infrastructures on AWS and GCP. Mentoring software engineers targeting senior and staff-level transitions.",
		yearOfExperience: 10,
		expertiseTags: [
			"AWS",
			"System Design",
			"Microservices",
			"Docker",
			"Kubernetes",
		],
		linkedinURL: "https://www.linkedin.com/in/tahmid-rahman",
		professionalDomain: "Software Engineering",
		sessionCharge: 50.0,
		averageRatings: 4.95,
		totalReviews: 42,
	},
	{
		email: "sarah.jenkins@example.com",
		name: "Sarah Jenkins",
		profileURL:
			"https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
		headline: "Fulbright Scholar & PhD Admissions Consultant",
		bio: "Guiding students through graduate school applications, SOP writing, scholarship hunting, and research proposal drafting for North American and European universities.",
		yearOfExperience: 7,
		expertiseTags: [
			"Higher Education",
			"SOP Review",
			"PhD Admissions",
			"Scholarships",
		],
		linkedinURL: "https://www.linkedin.com/in/sarah-jenkins-edu",
		professionalDomain: "Higher Study & Student Consultancy",
		sessionCharge: 40.0,
		averageRatings: 4.88,
		totalReviews: 35,
	},
	{
		email: "michael.chang@example.com",
		name: "Michael Chang",
		profileURL:
			"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
		headline: "Structural Engineer & BIM Specialist",
		bio: "Senior structural engineer with experience in high-rise building design, structural dynamics, and steel framing. Offering guidance on professional engineering licensure and site management.",
		yearOfExperience: 8,
		expertiseTags: [
			"Civil Engineering",
			"ETABS",
			"AutoCAD",
			"BIM",
			"Structural Analysis",
		],
		linkedinURL: "https://www.linkedin.com/in/michael-chang-ce",
		professionalDomain: "Civil Engineering",
		sessionCharge: 45.0,
		averageRatings: 4.8,
		totalReviews: 21,
	},
	{
		email: "advocate.farhana@example.com",
		name: "Farhana Chowdhury",
		profileURL:
			"https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
		headline: "Corporate Attorney & Intellectual Property Advisor",
		bio: "Practicing attorney advising startups on venture financing, intellectual property rights, non-disclosure agreements, and trademark applications.",
		yearOfExperience: 6,
		expertiseTags: [
			"Corporate Law",
			"Contracts",
			"IP Protection",
			"Startup Compliance",
		],
		linkedinURL: "https://www.linkedin.com/in/farhana-chowdhury-law",
		professionalDomain: "Law & Legal Advisory",
		sessionCharge: 60.0,
		averageRatings: 4.9,
		totalReviews: 18,
	},
	{
		email: "david.ross@example.com",
		name: "David Ross",
		profileURL:
			"https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80",
		headline: "Staff Product Designer @ FinTech",
		bio: "Dedicated to helping junior and mid-level designers refine their portfolios, master UX research methodologies, and tackle complex design systems.",
		yearOfExperience: 9,
		expertiseTags: [
			"UI/UX Design",
			"Figma",
			"Design Systems",
			"User Research",
			"Wireframing",
		],
		linkedinURL: "https://www.linkedin.com/in/david-ross-design",
		professionalDomain: "UI/UX Design",
		sessionCharge: 45.0,
		averageRatings: 4.92,
		totalReviews: 29,
	},
];
export const seedSuperAdmin = async () => {
	try {
		const isSuperAdminExist = await prisma.user.findFirst({
			where: {
				role: Role.SUPER_ADMIN,
			},
		});

		if (isSuperAdminExist) {
			console.log("Super Admin Already Exists!");
			return;
		}

		const name = config.super_admin_name;
		const email = config.super_admin_email;
		const password = config.super_admin_password;

		if (!name || !email || !password) {
			throw new Error(
				"Super Admin Name , Email, Password Missing In Env File!!!",
			);
		}

		const hashedPassword = await bcrypt.hash(
			password,
			Number(config.bcrypt_salt_rounds),
		);

		const superAdmin = await prisma.user.create({
			data: {
				name,
				email,
				password: hashedPassword,
				role: Role.SUPER_ADMIN,
				isEmailVerified: true,
			},
		});

		console.log("Super Admin Created : ", superAdmin);
	} catch (error) {
		console.log("Error Seeding Super Admin : ", error);

		await prisma.user.delete({
			where: {
				email: config.super_admin_email,
			},
		});
	}
};

export const seedMentors = async () => {
	try {
		console.log("🌱 Seeding Mentors...");

		const defaultHashedPassword = await bcrypt.hash(
			"Password123!",
			Number(config.bcrypt_salt_rounds) || 10,
		);

		for (const item of mentorsData) {
			// 1. Create or ensure user exists
			const user = await prisma.user.upsert({
				where: { email: item.email },
				update: {
					role: Role.MENTOR,
				},
				create: {
					name: item.name,
					email: item.email,
					password: defaultHashedPassword,
					role: Role.MENTOR,
					profileURL: item.profileURL,
					isEmailVerified: true,
				},
			});

			// 2. Create or update mentor profile linked via mentorId -> userId
			await prisma.mentor.upsert({
				where: { mentorId: user.userId },
				update: {
					verificationStatus: "APPROVED",
				},
				create: {
					mentorId: user.userId,
					headline: item.headline,
					bio: item.bio,
					yearOfExperience: item.yearOfExperience,
					expertiseTags: item.expertiseTags,
					linkedinURL: item.linkedinURL,
					professionalDomain: item.professionalDomain,
					sessionCharge: item.sessionCharge,
					averageRatings: item.averageRatings,
					totalReviews: item.totalReviews,
					totalSessionsCompleted: item.totalReviews + 5,
					verificationStatus: "APPROVED",
					resume:
						"https://res.cloudinary.com/demo/image/upload/sample_resume.pdf",
					documents: [
						{
							title: "Identity / Certificate",
							fileUrl:
								"https://res.cloudinary.com/demo/image/upload/sample_certificate.pdf",
							publicId: "sample_doc_1",
						},
					],
				},
			});

			//   console.log(`✅ Seeded Mentor: ${item.name} (${item.professionalDomain})`);
		}

		console.log("🚀 Mentors Seeding Completed!");
	} catch (error) {
		console.log("Error Seeding Mentors : ", error);
	}
};
