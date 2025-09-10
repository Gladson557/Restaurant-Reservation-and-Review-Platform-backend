import express from "express";
import { protect } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";
import {
  addReview,
  getReviewsByRestaurant,
  updateReview,
  deleteReview, respondToReview, getMyReviews
} from "../controllers/reviewController.js";

const router = express.Router();

router.post("/", protect,upload.array("photos",3),addReview);
router.get("/my", protect, getMyReviews);
router.get("/:restaurantId", getReviewsByRestaurant);
router.put("/:id", protect, updateReview);
router.delete("/:id", protect, deleteReview);
router.post("/:id/respond", protect, respondToReview);

export default router;
