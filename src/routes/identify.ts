import express from "express";
import { identifyContact } from "../services/contactService";

const router = express.Router();

router.post("/identify", async (req, res) => {
  const { email, phoneNumber } = req.body;

  if (!email && !phoneNumber) {
    return res.status(400).json({ error: "At least one field required" });
  }

  try {
    const result = await identifyContact(email, phoneNumber);
    res.status(200).json({ contact: result });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;