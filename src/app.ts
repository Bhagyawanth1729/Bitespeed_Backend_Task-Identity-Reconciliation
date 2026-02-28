import express from "express";
import identifyRoute from "./routes/identify";
import { pool } from "./db";

const app = express();

app.use(express.json());
app.use("/", identifyRoute);

pool.connect()
  .then(() => console.log("✅ Database Connected"))
  .catch((err) => console.error("❌ DB Connection Failed:", err));

app.listen(3000, () => {
  console.log("🚀 Server running on port 3000");
});