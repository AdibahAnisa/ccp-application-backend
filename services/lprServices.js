import axios from "axios";
import client from "../utils/db.js";
import { sendNotification } from "./notificationServices.js";

const normalizePlate = (plate) => plate?.toUpperCase().replace(/\s/g, "");

export const syncLPRPlates = async () => {
  try {
    console.log("🚀 Running LPR Sync...");

    const response = await axios.get(
      "http://lpr.vista-summerose.com:5002/api/plates",
    );

    const plates = response.data;

    for (const item of plates) {
      try {
        const plateNumber = normalizePlate(item.plate);
        const eventTime = new Date(item.timestamp);
        const now = new Date();

        // Only allow events within last 1 minute
        const diffMs = now - eventTime;

        if (diffMs > 30000) {
          console.log("⏱️ Skip old LPR event:", item.timestamp);
          continue;
        }
        const rawStatus = item.status?.toLowerCase() || "";

        let status = "unknown";

        if (rawStatus.includes("paid")) {
          status = "paid";
        } else if (rawStatus.includes("tidak") || rawStatus.includes("not")) {
          status = "not_paid";
        }
        const eventUuid = item.event_uuid;

        if (!plateNumber || !eventUuid) continue;

        console.log("\n==============================");
        console.log("📸 LPR Plate:", plateNumber);
        console.log("📌 Status:", status);

        // Prevent duplicate LPR event
        const existingEvent = await client.lprNotify.findUnique({
          where: { eventUuid },
        });

        if (existingEvent) {
          console.log("⚠️ Event already processed:", eventUuid);
          continue;
        }

        // Find vehicle owner
        const plate = await client.plateNumber.findFirst({
          where: {
            plateNumber: plateNumber,
          },
          include: {
            user: {
              include: {
                wallet: true,
              },
            },
          },
        });

        if (!plate) {
          console.log(`❌ No user found for plate: ${plateNumber}`);
          continue;
        }

        const user = plate.user;

        console.log("✅ User found:", user.id);

        // DUPLICATE CHECK HERE
        const recent = await client.lprNotify.findFirst({
          where: {
            plateNumber,
            createdAt: {
              gte: new Date(Date.now() - 5000), // 10 sec
            },
          },
        });

        if (recent) {
          console.log("⚠️ Skip duplicate notification (within 30s)");
          continue;
        }

        // Save LPR event
        await client.lprNotify.create({
          data: {
            userId: user.id,
            plateNumber,
            status: status,
            snapshotUrl: item.snapshot_url,
            eventUuid,
            eo_notified: false,
            detectedAt: new Date(item.timestamp),
          },
        });

        console.log("💾 LPR event saved");

        // ===============================
        // ADS LOGIC (5 SCENARIOS)
        // ===============================

        console.log("📤 Processing notification...");

        let type = "";

        if (status === "paid") {
          type = "PAID";
        } else {
          const hasWalletAmount = !!user.wallet?.walletAmount;
          const autoDeduct = user.autoDeduct;

          if (autoDeduct && hasWalletAmount) {
            type = "AUTO_PAID";
          } else if (autoDeduct && !hasWalletAmount) {
            type = "NO_WALLET";
          } else if (!autoDeduct && hasWalletAmount) {
            type = "AUTO_OFF";
          } else {
            type = "SETUP_REQUIRED";
          }
        }

        // Check FCM token (IMPORTANT)
        if (!user.fcmToken) {
          console.log("❌ No FCM token for user:", user.id);
        }

        // Send notification
        console.log("📤 Sending notification to user:", user.id);

        const plateText = plateNumber || "Unknown vehicle";

        await sendNotification(
          user.id,
          "Parking confirmation required",
          `An enforcement officer has detected your vehicle ${plateText}. Please confirm your parking within 5 minutes to avoid being fined.`,
          {
            type: "CONFIRM_PARKING",
            plateNumber: plateNumber,
          },
        );

        console.log("✅ Notification sent");
      } catch (innerError) {
        console.error("❌ Error processing plate:", innerError.message);
        continue;
      }
    }

    console.log("\n✅ LPR Sync Completed");
  } catch (error) {
    console.error("🔥 LPR Sync Error:", error.message);
  }
};
