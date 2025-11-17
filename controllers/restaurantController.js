// controllers/restaurantController.js
import Restaurant from "../models/Restaurant.js";
import Reservation from "../models/Reservation.js";
import mongoose from "mongoose";
import { safeEmit } from "../socketHelper.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Helper: parse possibly-JSON fields from req.body
 */
const parseMaybeJson = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    // Not JSON: return original string
    return value;
  }
};

/**
 * Helper: normalize features from string CSV or array
 */
const normalizeFeatures = (f) => {
  if (f === undefined) return undefined;
  if (Array.isArray(f)) return f.map((s) => String(s).trim()).filter(Boolean);
  return String(f).split(",").map((s) => s.trim()).filter(Boolean);
};

/**
 * POST /api/restaurants
 * Owner creates a restaurant. Accepts multipart/form-data (photos) or JSON.
 * Field notes:
 *  - features: array or CSV string
 *  - menuItems: JSON string or array [{name,price,description,category}]
 *  - hours: JSON string or object { monday: "9:00-22:00", ... }
 */
export const createRestaurant = async (req, res) => {
  try {
    const payload = {
      name: req.body.name,
      description: req.body.description || "",
      cuisineType: req.body.cuisineType || "",
      price: req.body.price !== undefined ? Number(req.body.price) : undefined,
      priceRange: req.body.priceRange || "",
      location: req.body.location || "",
      contact: req.body.contact || "",
      owner: req.user?._id,
      tablesPerSlot: req.body.tablesPerSlot ? Number(req.body.tablesPerSlot) : undefined,
    };

    // features
    const feats = normalizeFeatures(req.body.features);
    if (feats !== undefined) payload.features = feats;

    // menuItems
    const parsedMenu = parseMaybeJson(req.body.menuItems);
    if (parsedMenu !== undefined) {
      if (Array.isArray(parsedMenu)) payload.menuItems = parsedMenu;
      else payload.menuItems = [];
    }

    // hours
    const parsedHours = parseMaybeJson(req.body.hours);
    if (parsedHours !== undefined) payload.hours = parsedHours;

    // photos from multer
    if (req.files && req.files.length > 0) {
      payload.photos = req.files.map((f) => `/uploads/${f.filename}`);
    }

    const restaurant = await Restaurant.create(payload);

    try {
      safeEmit && safeEmit("restaurantCreated", restaurant);
    } catch (e) {
      // ignore emit errors
      console.warn("safeEmit restaurantCreated failed:", e?.message || e);
    }

    return res.status(201).json(restaurant);
  } catch (err) {
    console.error("createRestaurant error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/restaurants
 * Return a plain array (compatibility with existing frontend Home.jsx).
 * Supports a safe set of query filters (no pagination envelope).
 */
export const getRestaurants = async (req, res) => {
  try {
    // allow a safe set of filters (keeps behavior simple for frontend)
    const allowed = ["cuisineType", "location", "priceRange", "name"];
    const filter = {};
    for (const key of allowed) {
      if (req.query[key]) {
        filter[key] = { $regex: String(req.query[key]).trim(), $options: "i" };
      }
    }
    if (req.query.features) {
      const feats = normalizeFeatures(req.query.features);
      if (feats.length) filter.features = { $all: feats };
    }

    const restaurants = await Restaurant.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(restaurants);
  } catch (err) {
    console.error("getRestaurants error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};


/**
 * GET /api/restaurants/:id
 * Return full restaurant doc (populate owner)
 */
export const getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id).populate("owner", "name email");
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    return res.json(restaurant);
  } catch (err) {
    console.error("getRestaurantById error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /api/restaurants/:id
 * Update restaurant (owner or admin)
 * Accepts JSON and optional photos via multer
 */
export const updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    // Authorization
    const userId = req.user?._id?.toString();
    const ownerId = restaurant.owner?.toString();
    if (ownerId && ownerId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const oldCapacity = restaurant.tablesPerSlot ?? restaurant.capacity ?? 10;

    // Append uploaded photos
    if (req.files && req.files.length > 0) {
      const newPaths = req.files.map((f) => `/uploads/${f.filename}`);
      restaurant.photos = Array.isArray(restaurant.photos) ? restaurant.photos.concat(newPaths) : newPaths;
    }

    // Updatable simple fields
    const updatable = [
      "name",
      "description",
      "cuisineType",
      "price",
      "priceRange",
      "location",
      "contact",
      "tablesPerSlot",
    ];
    updatable.forEach((k) => {
      if (req.body[k] !== undefined) {
        // convert numeric
        if (k === "price" || k === "tablesPerSlot") {
          restaurant[k] = req.body[k] === "" ? undefined : Number(req.body[k]);
        } else restaurant[k] = req.body[k];
      }
    });

    // features
    if (req.body.features !== undefined) {
      restaurant.features = normalizeFeatures(req.body.features);
    }

    // menuItems (overwrite if provided)
    if (req.body.menuItems !== undefined) {
      const parsed = parseMaybeJson(req.body.menuItems);
      if (Array.isArray(parsed)) restaurant.menuItems = parsed;
      else {
        // if it's a CSV or single string, ignore for now
      }
    }

    // hours
    if (req.body.hours !== undefined) {
      const parsed = parseMaybeJson(req.body.hours);
      if (typeof parsed === "object") restaurant.hours = parsed;
      else {
        // if it's a simple string, store into a generic 'notes' field (optional)
        restaurant.hours = { general: String(parsed) };
      }
    }

    await restaurant.save();

    const newCapacity = restaurant.tablesPerSlot ?? restaurant.capacity ?? oldCapacity;
    if (newCapacity !== oldCapacity) {
      try {
        safeEmit &&
          safeEmit("restaurantCapacityChanged", {
            restaurantId: restaurant._id.toString(),
            capacity: newCapacity,
          });
        safeEmit &&
          safeEmit(
            "restaurantCapacityChanged",
            {
              restaurantId: restaurant._id.toString(),
              capacity: newCapacity,
            },
            `restaurant_${restaurant._id}`
          );
      } catch (e) {
        console.warn("safeEmit capacity changed failed", e?.message || e);
      }
    }

    try {
      safeEmit && safeEmit("restaurantUpdated", restaurant);
    } catch (e) {}

    return res.json(restaurant);
  } catch (err) {
    console.error("updateRestaurant error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * DELETE /api/restaurants/:id
 * Owner or admin can delete
 */
export const deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    const userId = req.user?._id?.toString();
    const ownerId = restaurant.owner?.toString();
    if (ownerId && ownerId !== userId && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    await restaurant.remove();

    try {
      safeEmit && safeEmit("restaurantDeleted", { id: restaurant._id.toString() });
    } catch (e) {}

    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteRestaurant error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/restaurants/my
 * Owner's restaurants list
 */
export const getMyRestaurants = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const restaurants = await Restaurant.find({ owner: ownerId }).sort({ createdAt: -1 });
    return res.json(restaurants);
  } catch (err) {
    console.error("getMyRestaurants error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * POST /api/restaurants/:id/menu
 * Add a menu item (owner only)
 * Body: { name, description, price, category }
 */
export const addMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    const userId = req.user._id.toString();
    const ownerId = restaurant.owner?.toString();
    if (ownerId && ownerId !== userId && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    const { name, description = "", price = 0, category = "" } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const item = { name, description, price: Number(price), category };
    restaurant.menuItems = restaurant.menuItems || [];
    restaurant.menuItems.push(item);
    await restaurant.save();

    const newItem = restaurant.menuItems[restaurant.menuItems.length - 1];
    return res.status(201).json(newItem);
  } catch (err) {
    console.error("addMenuItem error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /api/restaurants/:id/menu/:itemId
 * Update a menu item
 */
export const updateMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(itemId)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    const userId = req.user._id.toString();
    const ownerId = restaurant.owner?.toString();
    if (ownerId && ownerId !== userId && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    const item = restaurant.menuItems.id(itemId);
    if (!item) return res.status(404).json({ message: "Menu item not found" });

    ["name", "description", "price", "category"].forEach((k) => {
      if (req.body[k] !== undefined) item[k] = k === "price" ? Number(req.body[k]) : req.body[k];
    });

    await restaurant.save();
    return res.json(item);
  } catch (err) {
    console.error("updateMenuItem error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * DELETE /api/restaurants/:id/menu/:itemId
 */
export const deleteMenuItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    if (!isValidObjectId(id) || !isValidObjectId(itemId)) return res.status(400).json({ message: "Invalid id" });

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) return res.status(404).json({ message: "Not found" });

    const userId = req.user._id.toString();
    const ownerId = restaurant.owner?.toString();
    if (ownerId && ownerId !== userId && req.user.role !== "admin")
      return res.status(403).json({ message: "Not authorized" });

    const beforeCount = restaurant.menuItems.length;
    restaurant.menuItems = restaurant.menuItems.filter((it) => it._id.toString() !== itemId);
    if (restaurant.menuItems.length === beforeCount) return res.status(404).json({ message: "Menu item not found" });

    await restaurant.save();
    return res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteMenuItem error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /api/restaurants/search
 * (kept from previous implementation)
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

    // Price filtering (numeric)
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
 * GET /api/restaurants/:id/availability
 * (kept from previous implementation)
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
