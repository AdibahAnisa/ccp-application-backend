import express from "express";
import client from "../utils/db.js";
import { tokenMiddleware } from "../utils/authUtils.js";

const notificationRouter = express.Router();

notificationRouter.use(tokenMiddleware);

notificationRouter
  .get("/public", async (req, res) => {
    const userId = req.user.userId;
    try {
      const notification = await client.notification.findMany({
        where: { userId: userId },
      });
      res.status(200).json(notification);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .post("/create", async (req, res) => {
    const {
      userId,
      title,
      description,
      notifyTime,
      parkingId,
      monthlyPassId,
      reserveBayId,
      createdAt,
    } = req.body; // Destructure relevant data from req.body
    const id = uuidv4(); // Generate unique ID for MonthlyPass

    try {
      // Create a new MonthlyPass
      const createNotification = await client.notification.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          title: "Parking Alert",
          description: message,
          parkingId: parking.id,
          notifyTime: notifyTime,
          monthlyPassId: monthlyPassId ?? null,
          reserveBayId: reserveBayId ?? null,
          createdAt: createdAt || new Date(),
        },
      });

      res.status(201).json({ status: "success", data: createNotification });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .put("/edit/status/:id", async (req, res) => {
    const { id } = req.params;
    const { statusRead } = req.body; // Data to update

    try {
      // Check if the monthly pass exists and belongs to the user
      const existingNotification = await client.notification.findUnique({
        where: { id },
      });

      if (!existingNotification) {
        return res.status(404).json({
          error: "Notification not found.",
        });
      }

      // Update the monthly pass entry
      const updatedNotification = await client.notification.update({
        where: { id },
        data: {
          statusRead: statusRead || existingNotification.statusRead,
        },
      });

      res.status(200).json({
        status: "success",
        data: updatedNotification,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

export default notificationRouter;
