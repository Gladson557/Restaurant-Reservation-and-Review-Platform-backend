// controllers/restaurantController.js
import Restaurant from "../models/Restaurant.js";
import Reservation from "../models/Reservation.js";
import mongoose from "mongoose";
import { safeEmit } from "../socketHelper.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Add new restaurant (owner only)
export const createRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.create({
      ...req.body,
      owner: req.user._id,
    });
    res.status(201).json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all restaurants (basic, without advanced filters)
export const getRestaurants = async (req, res) => {
  try {
    const filters = req.query;
    const restaurants = await Restaurant.find(filters);
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get single restaurant
export const getRestaurantById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id))
      return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update restaurant (owner only)
export const updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    if (restaurant.owner.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Not authorized" });

    const oldCapacity =
      restaurant.tablesPerSlot ?? restaurant.capacity ?? 10;

    Object.assign(restaurant, req.body);
    await restaurant.save();

    // if capacity changed, broadcast availability refresh
    const newCapacity =
      restaurant.tablesPerSlot ?? restaurant.capacity ?? oldCapacity;

    if (newCapacity !== oldCapacity) {
      safeEmit("restaurantCapacityChanged", {
        restaurantId: restaurant._id.toString(),
        capacity: newCapacity,
      });
      safeEmit(
        "restaurantCapacityChanged",
        {
          restaurantId: restaurant._id.toString(),
          capacity: newCapacity,
        },
        `restaurant_${restaurant._id}`
      );
    }

    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Owner's restaurants
export const getMyRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ owner: req.user._id });
    res.json(restaurants);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/restaurants/search
 */
export const searchRestaurants = async (req, res) => {
  try {
    const {
      q,
      cuisine,
      minPrice,
      maxPrice,
      location,
      features,
      page = 1,
      limit = 20,
      sort,
    } = req.query;

    const filter = {};

    if (q) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: "i" } },
        { description: { $regex: q.trim(), $options: "i" } },
      ];
    }

    if (cuisine) {
      filter.cuisineType = { $regex: cuisine.trim(), $options: "i" };
    }

    if (location) {
      filter.location = { $regex: location.trim(), $options: "i" };
    }

    if (features) {
      const feats = String(features)
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
      if (feats.length) filter.features = { $all: feats };
    }

    // Price filtering (currently supports numeric field "price")
    if (minPrice || maxPrice) {
      const minN = minPrice ? Number(minPrice) : null;
      const maxN = maxPrice ? Number(maxPrice) : null;
      if (!isNaN(minN) || !isNaN(maxN)) {
        filter.$and = filter.$and || [];
        if (minN !== null) filter.$and.push({ price: { $gte: minN } });
        if (maxN !== null) filter.$and.push({ price: { $lte: maxN } });
      }
    }

    const pageN = Math.max(1, Number(page) || 1);
    const limN = Math.max(1, Math.min(100, Number(limit) || 20));
    const skip = (pageN - 1) * limN;

    const sortOption = {};
    if (sort) {
      const keys = sort.split(",");
      keys.forEach((k) => {
        if (!k) return;
        if (k.startsWith("-")) sortOption[k.slice(1)] = -1;
        else sortOption[k] = 1;
      });
    } else {
      sortOption.createdAt = -1;
    }

    const [results, total] = await Promise.all([
      Restaurant.find(filter).sort(sortOption).skip(skip).limit(limN).lean(),
      Restaurant.countDocuments(filter),
    ]);

    return res.json({
      data: results,
      meta: {
        total,
        page: pageN,
        limit: limN,
        pages: Math.ceil(total / limN),
      },
    });
  } catch (err) {
    console.error("searchRestaurants error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/restaurants/:id/availability?date=YYYY-MM-DD&time=HH:mm
 */
export const getAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.query;

    if (!isValidObjectId(id))
      return res.status(400).json({ message: "Invalid restaurant id" });
    if (!date || !time)
      return res
        .status(400)
        .json({ message: "date and time query parameters required" });

    const restaurant = await Restaurant.findById(id).select(
      "tablesPerSlot capacity"
    );
    if (!restaurant)
      return res.status(404).json({ message: "Restaurant not found" });

    const capacity =
      restaurant.tablesPerSlot ?? restaurant.capacity ?? 10;

    const booked = await Reservation.countDocuments({
      restaurant: id,
      date,
      time,
      status: { $ne: "cancelled" },
    });

    const available = Math.max(0, capacity - booked);

    return res.json({ restaurant: id, date, time, capacity, booked, available });
  } catch (err) {
    console.error("getAvailability error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};
