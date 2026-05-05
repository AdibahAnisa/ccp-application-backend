import express from "express";
import { testLPRNotification } from "../services/lprServices.js";

const router = express.Router();

router.post("/test-lpr-notification", testLPRNotification);

export default router;
