import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const production = process.env.NODE_ENV === "production";
const root = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required.");
}

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.startsWith("replace_")
) {
  throw new Error("Set JWT_SECRET to a randomly generated secret.");
}

if (!process.env.APP_ORIGIN) {
  throw new Error("APP_ORIGIN is required.");
}

app.use(helmet());
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Try again later." },
});

app.use("/api", apiLimiter);

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");

// SameSite cookies plus an Origin check protect browser write requests.
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  const origin = req.get("origin");

if (isWrite && origin && origin !== process.env.APP_ORIGIN) {
    return res.status(403).json({ message: "Origin not allowed." });
  }

next();
});

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    // An editable starter value, not a personalized dietary recommendation.
    goal: { type: Number, default: 2000, min: 1, max: 20000 },
  },
  { timestamps: true }
);

const entrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true, maxlength: 100 },
    calories: { type: Number, required: true, min: 1, max: 20000 },
    meal: {
      type: String,
      enum: ["Breakfast", "Lunch", "Dinner", "Snack"],
      required: true,
    },
    // A user's calendar date, intentionally not a UTC timestamp.
    date: { type: String, required: true },
  },
  { timestamps: true }
);

entrySchema.index({ user: 1, date: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);
const Entry = mongoose.model("Entry", entrySchema);

const cookieOptions = {
  httpOnly: true,
  secure: production,
  sameSite: "strict",
  path: "/",
};

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    goal: user.goal,
  };
}

function createSession(res, user) {
  const token = jwt.sign({}, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: "7d",
    issuer: "calorie-tracker",
    audience: "calorie-tracker-web",
    algorithm: "HS256",
  });

res.cookie("session", token, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function requireAuth(req, res, next) {
  let payload;

try {
    payload = jwt.verify(req.cookies.session || "", process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "calorie-tracker",
      audience: "calorie-tracker-web",
    });

if (
      typeof payload.sub !== "string" ||
      !/^[a-f\d]{24}$/i.test(payload.sub)
    ) {
      throw new Error("Invalid subject.");
    }
  } catch {
    return res.status(401).json({ message: "Please sign in again." });
  }

try {
    const user = await User.findById(payload.sub);

if (!user) {
      return res.status(401).json({ message: "Please sign in again." });
    }

req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validNumber(value) {
  return Number.isInteger(value) && value >= 1 && value <= 20000;
}

function readCredentials(body = {}) {
  return {
    email:
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "",
    password: typeof body.password === "string" ? body.password : "",
  };
}

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

if (
    name.length < 2 ||
    name.length > 60 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message:
        "Enter a name (2–60 characters), a valid email, and a password of at least 8 characters and at most 72 UTF-8 bytes.",
    });
  }

const passwordHash = await bcrypt.hash(password, 12);

try {
    const user = await User.create({ name, email, passwordHash });
    createSession(res, user);
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with that email already exists.",
      });
    }
    throw error;
  }
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const { email, password } = readCredentials(req.body);

if (
    !email ||
    email.length > 254 ||
    !password ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({ message: "Enter valid credentials." });
  }

const user = await User.findOne({ email }).select("+passwordHash");

if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

createSession(res, user);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("session", cookieOptions);
  res.sendStatus(204);
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.patch("/api/users/goal", requireAuth, async (req, res) => {
  const goal = req.body?.goal;

if (!validNumber(goal)) {
    return res.status(400).json({
      message: "Goal must be a whole number between 1 and 20,000.",
    });
  }

req.user.goal = goal;
  await req.user.save();

res.json({ user: publicUser(req.user) });
});

app.get("/api/entries", requireAuth, async (req, res) => {
  if (!validDate(req.query.date)) {
    return res.status(400).json({ message: "Use a valid YYYY-MM-DD date." });
  }

const entries = await Entry.find({
    user: req.user._id,
    date: req.query.date,
  })
    .sort({ createdAt: -1 })
    .lean();

res.json({ entries });
});

app.post("/api/entries", requireAuth, async (req, res) => {
  const { calories, meal, date } = req.body || {};
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";

if (
    !name ||
    name.length > 100 ||
    !validNumber(calories) ||
    !["Breakfast", "Lunch", "Dinner", "Snack"].includes(meal) ||
    !validDate(date)
  ) {
    return res.status(400).json({
      message: "Provide a food name, valid meal, date, and 1–20,000 calories.",
    });
  }

const entry = await Entry.create({
    user: req.user._id,
    name,
    calories,
    meal,
    date,
  });

res.status(201).json({ entry });
});

app.delete("/api/entries/:id", requireAuth, async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid entry ID." });
  }

// User ownership is checked inside the database operation.
  const entry = await Entry.findOneAndDelete({
    _id: req.params.id,
    user: req.user._id,
  });

if (!entry) {
    return res.status(404).json({ message: "Entry not found." });
  }

res.sendStatus(204);
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API route not found." });
});

if (production) {
  const clientDist = path.resolve(root, "../../client/dist");

app.use(express.static(clientDist));

app.use((req, res, next) => {
    if (req.method !== "GET" || !req.accepts("html")) {
      return next();
    }

res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large." });
  }

if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body." });
  }

console.error(error);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});

try {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.init();
  await Entry.init();

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
} catch (error) {
  console.error("Unable to start server:", error.message);
  process.exit(1);
}
