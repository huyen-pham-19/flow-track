const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = "flowtrack-super-secret-key-change-this-in-production";
const DB_FILE = path.join(__dirname, "users.json");

app.use(cors());
app.use(express.json());

function ensureDbFile() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

function readDb() {
  ensureDbFile();

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const parsed = JSON.parse(raw);

    if (!parsed.users || !Array.isArray(parsed.users)) {
      return { users: [] };
    }

    return parsed;
  } catch (error) {
    console.error("Read DB error:", error);
    return { users: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [type, token] = authHeader.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.auth = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name) {
      return res.status(400).json({ message: "Vui lòng nhập họ tên." });
    }

    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu cần ít nhất 6 ký tự." });
    }

    const db = readDb();

    const existedUser = db.users.find((user) => user.email === email);
    if (existedUser) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = {
    id: uid(),
    name,
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
    appState: {
    theme: "dark",
    activePage: "board",
    boardFilter: "all",
    calendarView: "week",
    calendarDate: new Date().toISOString().slice(0, 10),
    columns: [
      { id: "todo", title: "To Do", color: "#f25ad4" },
      { id: "doing", title: "Doing", color: "#8b5cf6" },
      { id: "done", title: "Done", color: "#27c281" }
    ],
    tasks: []
    }
    };

    db.users.push(user);
    writeDb(db);

    const token = generateToken(user);

    return res.status(201).json({
      message: "Đăng ký thành công.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu." });
    }

    const db = readDb();
    const user = db.users.find((item) => item.email === email);

    if (!user) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    }

    const passwordMatched = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatched) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không đúng." });
    }

    const token = generateToken(user);

    return res.json({
      message: "Đăng nhập thành công.",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

app.get("/api/me", authMiddleware, (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find((item) => item.id === req.auth.userId);

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại." });
    }

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

app.get("/api/state", authMiddleware, (req, res) => {
  try {
    const db = readDb();
    const user = db.users.find((item) => item.id === req.auth.userId);

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại." });
    }

    return res.json({
      state: user.appState || {
        theme: "dark",
        activePage: "board",
        boardFilter: "all",
        calendarView: "week",
        calendarDate: new Date().toISOString().slice(0, 10),
        columns: [
          { id: "todo", title: "To Do", color: "#f25ad4" },
          { id: "doing", title: "Doing", color: "#8b5cf6" },
          { id: "done", title: "Done", color: "#27c281" }
        ],
        tasks: []
      }
    });
  } catch (error) {
    console.error("Get state error:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

app.put("/api/state", authMiddleware, (req, res) => {
  try {
    const db = readDb();
    const userIndex = db.users.findIndex((item) => item.id === req.auth.userId);

    if (userIndex === -1) {
      return res.status(404).json({ message: "User không tồn tại." });
    }

    const incomingState = req.body;

    if (!incomingState || typeof incomingState !== "object") {
      return res.status(400).json({ message: "State không hợp lệ." });
    }

    db.users[userIndex].appState = {
      theme: typeof incomingState.theme === "string" ? incomingState.theme : "dark",
      activePage: typeof incomingState.activePage === "string" ? incomingState.activePage : "board",
      boardFilter: typeof incomingState.boardFilter === "string" ? incomingState.boardFilter : "all",
      calendarView: typeof incomingState.calendarView === "string" ? incomingState.calendarView : "week",
      calendarDate: typeof incomingState.calendarDate === "string"
        ? incomingState.calendarDate
        : new Date().toISOString().slice(0, 10),
      columns: Array.isArray(incomingState.columns) ? incomingState.columns : [],
      tasks: Array.isArray(incomingState.tasks) ? incomingState.tasks : []
    };

    writeDb(db);

    return res.json({
      message: "Lưu dữ liệu thành công.",
      state: db.users[userIndex].appState
    });
  } catch (error) {
    console.error("Save state error:", error);
    return res.status(500).json({ message: "Lỗi server." });
  }
});

app.listen(PORT, () => {
  console.log(`FlowTrack auth server is running at http://localhost:${PORT}`);
});