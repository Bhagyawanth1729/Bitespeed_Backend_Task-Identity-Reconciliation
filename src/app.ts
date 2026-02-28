import express from "express";
import identifyRoute from "./routes/identify";

const app = express();

app.use(express.json());

app.use("/identify", identifyRoute);

app.get("/", (req, res) => {
  res.send("Bitespeed Identity Reconciliation API is running 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
