import express from "express";
import { tokenMiddleware } from "../utils/authUtils.js";
import logger from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";
import client from "../utils/db.js";

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
    const { userId, plateNumber, expiredAt, pbt, location, area, state } = req.body; // Data to update

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
