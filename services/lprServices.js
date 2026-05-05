import axios from "axios";
import client from "../utils/db.js";
import { sendNotification } from "./notificationServices.js";
import { sendFCM } from "../utils/fcm.js";

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

        const existingEvent = await client.lprNotify.findUnique({
          where: { eventUuid },
        });

        if (existingEvent) {
          console.log("⚠️ Event already processed:", eventUuid);
          continue;
        }

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

        const recent = await client.lprNotify.findFirst({
          where: {
            plateNumber,
            detectedAt: {
              gte: new Date(Date.now() - 60000),
            },
          },
        });

        if (recent) {
          console.log("⚠️ Skip duplicate notification");
          continue;
        }

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

        console.log("📤 Processing notification...");

        let type;

        const walletAmount = Number(user.wallet?.walletAmount || 0);

        // Change this to your actual parking fee amount
        const requiredAmount = 10.0;

        const autoDeduct = user.autoDeduct;

        if (status === "paid") {
          type = "PAID";
        } else if (
          (!user.wallet || walletAmount < requiredAmount) &&
          !autoDeduct
        ) {
          type = "NO_WALLET_AND_AUTO_OFF";
        } else if (!user.wallet || walletAmount < requiredAmount) {
          type = "NO_WALLET";
        } else if (!autoDeduct) {
          type = "AUTO_OFF";
        } else {
          type = "READY_TO_DEDUCT";
        }

        if (!user.fcmToken) {
          console.log("❌ No FCM token for user:", user.id);
          continue;
        }

        console.log("📤 Type:", type);

        if (type === "PAID") {
          await sendNotification(
            user.id,
            "Parking already paid",
            `Your vehicle ${plateNumber} parking is already paid.`,
            {
              type: "PAID",
              plateNumber,
            },
          );

          console.log("✅ Parking already paid notification sent");
          continue;
        }

        if (type === "NO_WALLET_AND_AUTO_OFF") {
          await sendNotification(
            user.id,
            "Parking confirmation required",
            `An enforcement officer has detected your vehicle ${plateNumber}. Please confirm your parking within 5 minutes to avoid being fined.`,
            {
              type: "NO_WALLET_AND_AUTO_OFF",
              plateNumber,
              requiredAmount: requiredAmount.toString(),
              action: "ENABLE_AUTO_DEDUCT",
            },
          );

          console.log("✅ Auto deduct required notification sent");
          continue;
        }

        if (type === "NO_WALLET") {
          await sendNotification(
            user.id,
            "Parking confirmation required",
            `An enforcement officer has detected your vehicle ${plateNumber}. Please confirm your parking within 5 minutes to avoid being fined.`,
            {
              type: "NO_WALLET",
              plateNumber,
              requiredAmount: requiredAmount.toString(),
              action: "TOPUP",
            },
          );

          console.log("✅ Topup required notification sent");
          continue;
        }

        if (type === "AUTO_OFF") {
          await sendNotification(
            user.id,
            "Pengesahan Parkir Diperlukan",
            `Pegawai Penguatkuasa telah mengesan kenderaan ${plateNumber}. Sila buat pengesahan dalam tempoh 5 minit bagi mengelakkan dikompaun.`,
            {
              type: "AUTO_OFF",
              plateNumber,
              requiredAmount: requiredAmount.toString(),
              action: "CONFIRM_PARKING",
            },
          );

          console.log("✅ Auto off parking confirmation sent");
          continue;
        }

        if (type === "READY_TO_DEDUCT") {
          await sendNotification(
            user.id,
            "Parking confirmation required",
            `An enforcement officer has detected your vehicle ${plateNumber}. Please confirm your parking within 5 minutes to avoid being fined.`,
            {
              type: "READY_TO_DEDUCT",
              plateNumber,
              requiredAmount: requiredAmount.toString(),
            },
          );

          console.log("✅ Confirm parking notification sent");
          continue;
        }

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

// TEST LPR USING POSTMAN

export const testLPRNotification = async (req, res) => {
  try {
    const { plateNumber, status = "not_paid" } = req.body;

    const normalizedPlate = normalizePlate(plateNumber);

    if (!normalizedPlate) {
      return res.status(400).json({ message: "plateNumber is required" });
    }

    const plate = await client.plateNumber.findFirst({
      where: {
        plateNumber: normalizedPlate,
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
      return res.status(404).json({
        message: `No user found for plate ${normalizedPlate}`,
      });
    }

    const user = plate.user;

    const walletAmount = Number(user.wallet?.walletAmount || 0);
    const requiredAmount = 10.0;
    const autoDeduct = user.autoDeduct;

    let type;

    if (status === "paid") {
      type = "PAID";
    } else if ((!user.wallet || walletAmount < requiredAmount) && !autoDeduct) {
      type = "NO_WALLET_AND_AUTO_OFF";
    } else if (!user.wallet || walletAmount < requiredAmount) {
      type = "NO_WALLET";
    } else if (!autoDeduct) {
      type = "AUTO_OFF";
    } else {
      type = "READY_TO_DEDUCT";
    }

    if (!user.fcmToken) {
      return res.status(400).json({
        message: "User has no FCM token",
        userId: user.id,
      });
    }

    if (type === "NO_WALLET_AND_AUTO_OFF") {
      await sendNotification(
        user.id,
        "Parking confirmation required",
        `An enforcement officer has detected your vehicle ${normalizedPlate}. Please confirm your parking within 5 minutes to avoid being fined.`,
        {
          type: "NO_WALLET_AND_AUTO_OFF",
          plateNumber: normalizedPlate,
          requiredAmount: requiredAmount.toString(),
          action: "ENABLE_AUTO_DEDUCT",
        },
      );
    } else if (type === "NO_WALLET") {
      await sendNotification(
        user.id,
        "Parking confirmation required",
        `An enforcement officer has detected your vehicle ${normalizedPlate}. Please confirm your parking within 5 minutes to avoid being fined.`,
        {
          type: "NO_WALLET",
          plateNumber: normalizedPlate,
          requiredAmount: requiredAmount.toString(),
          action: "TOPUP",
        },
      );
    }

    if (type === "AUTO_OFF") {
      await sendNotification(
        user.id,
        "Pengesahan Parkir Diperlukan",
        `Pegawai Penguatkuasa telah mengesan kenderaan ${plateNumber}. Sila buat pengesahan dalam tempoh 5 minit bagi mengelakkan dikompaun.`,
        {
          type: "AUTO_OFF",
          plateNumber,
          requiredAmount: requiredAmount.toString(),
          action: "CONFIRM_PARKING",
        },
      );
    } else if (type === "READY_TO_DEDUCT") {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 1 * 60 * 60 * 1000);

      await sendNotification(
        user.id,
        "Auto Deduct Berjaya",
        `Bayaran parkir untuk ${normalizedPlate} telah berjaya.`,
        {
          type: "AUTO_PAID",
          plateNumber: normalizedPlate,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      );
    } else if (type === "PAID") {
      await sendNotification(
        user.id,
        "Parking already paid",
        `Your vehicle ${normalizedPlate} parking is already paid.`,
        {
          type: "PAID",
          plateNumber: normalizedPlate,
        },
      );
    }

    return res.json({
      message: "Test notification sent successfully",
      plateNumber: normalizedPlate,
      type,
      walletAmount,
      autoDeduct,
    });
  } catch (error) {
    console.error("❌ Test LPR notification error:", error);
    return res.status(500).json({ error: error.message });
  }
};
