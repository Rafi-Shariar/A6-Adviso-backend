import { Router } from "express";

import { validateRequest } from "../../middleware/validateRequest";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";
import { upload } from "../../lib/multer";
import { BlogController } from "./blog.controller";

const router = Router();

router.get("/", BlogController.allBlogsForUser);
router.post("/add", auth(Role.MENTOR), BlogController.uploadBlog);
router.patch(
	"/banner-image/:blogId",
	auth(Role.MENTOR),
	upload.single("bannerImage"),
	BlogController.uploadBannerImage,
);
router.patch("/update/:blogId", auth(Role.MENTOR), BlogController.updateBlog);
router.delete(
	"/delete/:blogId",
	auth(Role.MENTOR, Role.SUPER_ADMIN, Role.ADMIN),
	BlogController.deleteBlog,
);
router.get("/featured-blogs", BlogController.homepageBlogs);
router.get("/my-blogs", auth(Role.MENTOR), BlogController.myBlogs);
router.get(
	"/all-blogs",
	auth(Role.ADMIN, Role.SUPER_ADMIN),
	BlogController.allBlogsForAdmin,
);
router.get("/:blogId", BlogController.blogDetails);

export const BlogRoutes = router;
