const express = require("express");
require("dotenv").config();
const mysql = require("mysql2/promise");
const path = require("path");

const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;

if (!DB_HOST || !DB_USER || DB_PASSWORD === undefined || !DB_NAME) {
  throw new Error("DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME must be set");
}

const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/notes", async (req, res, next) => {
  try {
    const [notes] = await pool.execute(
      "SELECT id, content, created_at FROM notes ORDER BY created_at DESC, id DESC"
    );
    res.json(notes);
  } catch (error) {
    next(error);
  }
});

app.post("/api/notes", async (req, res, next) => {
  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  if (!content) {
    return res.status(400).json({ error: "Note content is required." });
  }

  try {
    const [result] = await pool.execute(
      "INSERT INTO notes (content) VALUES (?)",
      [content]
    );
    const [notes] = await pool.execute(
      "SELECT id, content, created_at FROM notes WHERE id = ?",
      [result.insertId]
    );
    res.status(201).json(notes[0]);
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: "An unexpected server error occurred." });
});

async function startServer() {
  while (true) {
    try {
      const connection = await pool.getConnection();
      try {
        await connection.execute(`
          CREATE TABLE IF NOT EXISTS notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } finally {
        connection.release();
      }

      app.listen(3010, "0.0.0.0", () => {
        console.log("Notes app listening on 0.0.0.0:3010");
      });
      return;
    } catch (error) {
      console.error(`MySQL is not ready (${error.message}). Retrying in 3 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

startServer();
