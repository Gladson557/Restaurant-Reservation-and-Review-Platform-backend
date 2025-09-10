import Review from "../models/Review.js";
import Restaurant from "../models/Restaurant.js";

// Add new review
export const addReview = async (req, res) => {
  try {
    const { restaurant, rating, comment } = req.body;
    const photos = req.files ? req.files.map((f) => `/uploads/reviews/${f.filename}`) : [];

    const review = await Review.create({
      restaurant,
      user: req.user._id,
      rating,
      comment,
      photos,
    });

    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get reviews for a restaurant
export const getReviewsByRestaurant = async (req, res) => {
  try {
    const reviews = await Review.find({ restaurant: req.params.restaurantId })
      .populate("user", "name")
      .populate("restaurant", "name");
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update a review
export const updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    review.rating = req.body.rating || review.rating;
    review.comment = req.body.comment || review.comment;
    review.photos = req.body.photos || review.photos;

    await review.save();
    res.json(review);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a review
export const deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await review.deleteOne();
    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Owner respond to review
export const respondToReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id).populate("restaurant");
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to respond" });
    }

    review.response = req.body.response;
    await review.save();

    res.json({ message: "Response added", review });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate("restaurant", "name location cuisineType priceRange contact")
      .sort({ createdAt: -1 }); // latest first

    res.json(reviews);
  } catch (err) {
    console.error("Get my reviews error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

