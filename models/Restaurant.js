import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    cuisineType: String,
    price: Number, // average per person
    priceRange: String,
    location: String,
    contact: String,

    photos: [String], // /uploads/file.jpg paths
    features: [String], // e.g., ["outdoor", "vegan"]

    menuItems: [
      { name: String, description: String, price: Number, category: String },
    ],

    hours: {
      monday: String,
      tuesday: String,
      wednesday: String,
      thursday: String,
      friday: String,
      saturday: String,
      sunday: String,
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tablesPerSlot: { type: Number, default: 10 },
  },
  { timestamps: true }
);

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
