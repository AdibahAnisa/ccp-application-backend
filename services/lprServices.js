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
        const status = item.status?.toLowerCase();
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
        // const recent = await client.lprNotify.findFirst({
        //   where: {
        //     plateNumber,
        //     createdAt: {
        //       gte: new Date(Date.now() - 30000), // 30 sec
        //     },
        //   },
        // });

        // if (recent) {
        //   console.log("⚠️ Skip duplicate notification (within 30s)");
        //   continue;
        // }

        // Save LPR event
        await client.lprNotify.create({
          data: {
            userId: user.id,
            plateNumber,
            status,
            snapshotUrl: item.snapshot_url,
            eventUuid,
          },
        });

        console.log("💾 LPR event saved");

        // ===============================
        // ADS LOGIC (5 SCENARIOS)
        // ===============================

        console.log("📤 Processing notification...");

        let title = "";
        let message = "";

        if (status === "paid") {
          message = `Terima kasih 😊 No plate ${plateNumber} telah membuat bayaran parking.`;
        } else {
          const hasWalletAmount = !!user.wallet?.walletAmount;
          const autoDeduct = user.autoDeduct;

          if (autoDeduct && hasWalletAmount) {
            message = `Terima kasih 😊 Bayaran parking untuk ${plateNumber} telah dibuat secara automatik.`;
          } else if (autoDeduct && !hasWalletAmount) {
            message = `⚠️ Tiada wallet. Sila tambah kaedah pembayaran untuk ${plateNumber}.`;
          } else if (!autoDeduct && hasWalletAmount) {
            message = `⚠️ Sila aktifkan auto deduct untuk ${plateNumber}.`;
          } else {
            message = `⚠️ Sila aktifkan auto deduct dan tambah kaedah pembayaran untuk ${plateNumber}.`;
          }
        }

        // Check FCM token (IMPORTANT)
        if (!user.fcmToken) {
          console.log("❌ No FCM token for user:", user.id);
        }

        // Send notification
        console.log("📤 Sending notification to user:", user.id);

        await sendNotification(user.id, "Parking Update", message);

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
