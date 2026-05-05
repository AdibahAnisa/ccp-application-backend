import express from "express";
import { tokenMiddleware } from "../utils/authUtils.js";
import { getParkingAmount } from "../utils/parkingRateHelper.js";
import logger from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import client from "../utils/db.js";
import { authenticateToken } from "../utils/authUtils.js";

const parkingRouter = express.Router();

parkingRouter
  .get("/public", async (req, res) => {
    try {
      const allParking = await client.parking.findMany();

      res.status(200).json(allParking);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .get("/single/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const singleParking = await client.parking.findUnique({
        where: { id },
      });

      res.status(200).json(singleParking);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .put("/edit/:id", async (req, res) => {
    const { id } = req.params;
    const { userId, plateNumber, expiredAt, pbt, location, area, state } =
      req.body; // Data to update

    try {
      // Check if the parking exists and belongs to the user
      const existingParking = await client.parking.findUnique({
        where: { id },
      });

      if (!existingParking) {
        return res.status(404).json({
          error: "Parking not found.",
        });
      }

      // Update the Parking entry
      const updatedParking = await client.parking.update({
        where: { id },
        data: {
          userId: userId || existingParking.userId,
          plateNumber: plateNumber || existingParking.plateNumber,
          pbt: pbt || existingParking.pbt,
          location: location || existingParking.location,
          area: area || existingParking.area,
          state: state || existingParking.state,
          expiredAt: expiredAt || existingParking.expiredAt,
        },
      });

      res.status(200).json({ status: "success", data: updatedParking });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .delete("/delete/:id", async (req, res) => {
    const { id } = req.params; // The Parking ID from the URL parameter
    try {
      // Check if the parking entry exists and belongs to the user
      const existingParking = await client.parking.findUnique({
        where: { id },
      });

      if (!existingParking) {
        return res.status(404).json({
          error: "Parking not found.",
        });
      }

      // Delete the parking entry
      await client.parking.delete({
        where: { id },
      });

      res.status(200).json({
        status: "success",
        message: "Parking deleted successfully.",
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

parkingRouter.use(tokenMiddleware);

parkingRouter.post("/confirm", async (req, res) => {
  console.log("📩 PARKING CONFIRM BODY:", req.body);
  console.log("👤 PARKING CONFIRM USER:", req.user);
  try {
    const { plateNumber, hours, pbt, location, area, state } = req.body;
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.userId;

    const user = await client.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    const walletAmount = Number(user.wallet?.walletAmount || 0);
    const requiredAmount = getParkingAmount(state, Number(hours));
    const autoDeduct = user.autoDeduct;

    // =========================
    // 🔥 5 SCENARIOS CHECK
    // =========================
    if ((!user.wallet || walletAmount < requiredAmount) && !autoDeduct) {
      return res.json({
        success: false,
        type: "NO_WALLET_AND_AUTO_OFF",
        plateNumber,
        hours,
        requiredAmount,
        action: "GO_AUTO_DEDUCT",
      });
    }

    if (!user.wallet || walletAmount < requiredAmount) {
      return res.json({
        success: false,
        type: "NO_WALLET",
        plateNumber,
        hours,
        requiredAmount,
        action: "GO_RELOAD",
      });
    }

    if (!autoDeduct) {
      return res.json({
        success: false,
        type: "AUTO_OFF",
        plateNumber,
        hours,
        requiredAmount,
        action: "GO_AUTO_DEDUCT",
      });
    }

    if (!autoDeduct) {
      return res.json({ success: false, type: "AUTO_OFF" });
    }

    // =========================
    // ✅ READY_TO_DEDUCT
    // =========================

    // 1. Deduct wallet
    const updatedWallet = await client.wallet.update({
      where: { id: user.wallet.id },
      data: {
        walletAmount: walletAmount - requiredAmount,
      },
    });

    // 2. Create wallet transaction (IMPORTANT)
    const walletTransaction = await client.walletTransaction.create({
      data: {
        id: uuidv4(),
        userId,
        amount: requiredAmount,
        type: "DEBIT",
        description: `Parking payment for ${plateNumber}`,
      },
    });

    // 3. Create parking record (YOU ALREADY HAVE THIS TABLE)
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

    const parking = await client.parking.create({
      data: {
        id: uuidv4(),
        plateNumber,
        pbt,
        location,
        area,
        state,
        expiredAt: endTime,
        user: {
          connect: { id: userId },
        },
        walletTransaction: {
          connect: { id: walletTransaction.id },
        },
      },
    });

    // =========================
    // 🎯 RESPONSE TO FLUTTER
    // =========================
    return res.json({
      success: true,
      type: "AUTO_PAID",
      plateNumber,
      startTime,
      endTime,
      amount: requiredAmount,
      parkingId: parking.id,
    });
  } catch (err) {
    console.error("❌ PARKING CONFIRM ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
});

parkingRouter.post("/auto-deduct", async (req, res) => {
  try {
    const userId = req.user.userId;
    const { enabled, plateNumber, hours, state } = req.body;

    // 1. Update auto deduct
    await client.user.update({
      where: { id: userId },
      data: {
        autoDeduct: enabled === true,
      },
    });

    // ❗ ONLY continue if enabling
    if (enabled && plateNumber && hours) {
      const user = await client.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      const amount = getParkingAmount(state, Number(hours));

      if (!user.wallet || Number(user.wallet.walletAmount) < amount) {
        return res.json({
          success: false,
          type: "INSUFFICIENT_BALANCE",
          amount,
        });
      }

      // 2. Deduct wallet
      await client.wallet.update({
        where: { userId },
        data: {
          walletAmount: {
            decrement: amount,
          },
        },
      });

      // 3. Create parking session
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

      return res.json({
        success: true,
        type: "AUTO_PAID",
        startTime,
        endTime,
      });
    }

    return res.json({
      success: true,
      autoDeduct: enabled === true,
    });
  } catch (err) {
    console.error("❌ AUTO DEDUCT ERROR:", err);
    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
});

parkingRouter
  .get("/", async (req, res) => {
    const userId = req.user.userId; // Assuming this is obtained via authentication middleware
    try {
      const allParking = await client.parking.findMany({
        where: { userId },
      });
      res.status(200).json(allParking);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .post("/create", async (req, res) => {
    const userId = req.user.userId; // Assuming this is obtained via authentication middleware
    const {
      walletTransactionId,
      plateNumber,
      expiredAt,
      pbt,
      location,
      area,
      state,
      noReceipt,
    } = req.body; // Destructure relevant data from req.body
    const id = uuidv4(); // Generate unique ID

    try {
      // Create a new Parking entry
      const newParking = await client.parking.create({
        data: {
          id,
          plateNumber,
          pbt,
          location,
          area,
          state,
          expiredAt,
          noReceipt,
          // Connect existing user
          user: {
            connect: { id: userId }, // Use userId to connect the user
          },
          // Connect existing walletTransaction
          walletTransaction: {
            connect: { id: walletTransactionId }, // Use walletTransactionId to connect the WalletTransaction
          },
        },
      });

      res.status(201).json({ status: "success", data: newParking });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

export default parkingRouter;
