import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { registerRoutes } from "./server/routes";
import { initDatabase } from "./server/incidentsDb";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register all modular API routes
registerRoutes(app);

// Express server boot and Vite middleware handler
async function startServer() {
  // Initialize the Cloud SQL Postgres incidents database
  try {
    await initDatabase();
    console.log("Cloud SQL Postgres database initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Cloud SQL Postgres database:", err);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
