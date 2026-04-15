import cron from "node-cron";
import { syncLPRPlates } from "../services/lprServices.js";

export const startLPRCron = () => {
  cron.schedule("*/30 * * * * *", async () => {
    console.log("Running LPR Cron...");
    await syncLPRPlates();
  });
};
