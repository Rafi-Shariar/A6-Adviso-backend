import bcrypt from "bcryptjs";
import { Role } from "../../generated/prisma/enums";
import config from "../config";
import { prisma } from "../lib/prisma";
import { mentorsData } from "../constant/mentor.seed";



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
	const mentorCount = await prisma.mentor.count();
  
  if (mentorCount > 0) {
	console.log("Mentors already existed");

    return;
  }

  
    const defaultHashedPassword = await bcrypt.hash(
      "Password123!",
      Number(config.bcrypt_salt_rounds) || 10,
    );

	

    for (const item of mentorsData) {
      // 1. User create ba role update
      const user = await prisma.user.upsert({
        where: { email: item.email },
        update: {
          role: Role.MENTOR,
          profileURL: item.profileURL,
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

      // 2. Mentor profile create ba update
      await prisma.mentor.upsert({
        where: { mentorId: user.userId },
        update: {
          verificationStatus: "APPROVED",
          headline: item.headline,
          bio: item.bio,
          yearOfExperience: item.yearOfExperience,
          expertiseTags: item.expertiseTags,
          linkedinURL: item.linkedinURL,
          professionalDomain: item.professionalDomain,
          sessionCharge: item.sessionCharge,
          averageRatings: item.averageRatings,
          totalReviews: item.totalReviews,
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
    }

    console.log("Mentors Seeding Completed Successfully!");
  } catch (error) {
    console.error("Error Seeding Mentors : ", error);
  }
};

export const seedDefaultUser = async () => {
    try {
        const userEmail = config.default_user_email;

        if (!userEmail) {
            console.log("Default user email missing in config. Skipping user seed.");
            return;
        }

        const isUserExist = await prisma.user.findUnique({
            where: {
                email: userEmail,
            },
        });

        if (isUserExist) {
            console.log("Default User Already Exists!");
            return;
        }

        const name = config.default_user_name || "Demo User";
        const password = config.default_user_password;

        if (!password) {
            throw new Error("Default User Password Missing In Env File!");
        }

        const hashedPassword = await bcrypt.hash(
            password,
            Number(config.bcrypt_salt_rounds),
        );

        const defaultUser = await prisma.user.create({
            data: {
                name,
                email: userEmail,
                password: hashedPassword,
                role: Role.USER,
                isEmailVerified: true,
            },
        });

        console.log("Default User Created: ", {
            userId: defaultUser.userId,
            email: defaultUser.email,
            role: defaultUser.role,
        });
    } catch (error) {
        console.error("Error Seeding Default User: ", error);
    }
};
