import cron from "node-cron";
import { syncLPRPlates } from "../services/lprServices.js";

export const startLPRCron = () => {
  cron.schedule("*/3 * * * * *", async () => {
    console.log("Running LPR Cron...");
    await syncLPRPlates();
  });
};
