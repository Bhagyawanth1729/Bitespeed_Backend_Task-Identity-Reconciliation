import express from "express";
import identifyRoute from "./routes/identify";

const app = express();

app.use(express.json());
app.use("/", identifyRoute);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
