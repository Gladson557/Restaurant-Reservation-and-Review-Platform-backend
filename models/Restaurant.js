import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  cuisineType: String,
  price: Number, // e.g., average price per person
  priceRange: String,
  location: String,
  contact: String,
  photos: [String],
  features: [String],
  menuItems: [{ name: String, price: Number }],
  hours: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tablesPerSlot: { type: Number, default: 10 }
}, { timestamps: true });

const Restaurant = mongoose.model("Restaurant", restaurantSchema);
export default Restaurant;
