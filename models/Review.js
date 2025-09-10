import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    photos: [{ type: String }],   // ✅ allow photo uploads
    response: { type: String },   // owner response
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", reviewSchema);
export default Review;
