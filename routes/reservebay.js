import express from "express";
import { tokenMiddleware } from "../utils/authUtils.js";
import { v4 as uuidv4 } from "uuid";
import client from "../utils/db.js";
import logger from "../utils/logger.js";
import { now } from "sequelize/lib/utils";

const reservebayRouter = express.Router();

reservebayRouter
  .get("/public", async (req, res) => {
    try {
      const reserveBays = await client.reserveBay.findMany();

      res.status(200).json(reserveBays);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .get("/single/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const singleReserveBay = await client.reserveBay.findUnique({
        where: { id },
      });

      res.status(200).json(singleReserveBay);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .post("/public/create", async (req, res) => {
    const {
      userId,
      companyName,
      companyRegistration,
      businessType,
      address1,
      address2,
      address3,
      postcode,
      city,
      state,
      picFirstName,
      picSecondName,
      phoneNumber,
      email,
      idNumber,
      totalLotRequired,
      reason,
      lotNumber,
      location,
      designatedBayPicture,
      registerNumberPicture,
      idCardPicture,
      createdAt,
    } = req.body; // Destructure relevant data from req.body
    const id = uuidv4(); // Generate unique ID for Reserve Bay

    try {
      // Create a new Reserve Bay
      const newReserveBay = await client.reserveBay.create({
        data: {
          id,
          userId: userId,
          companyName: companyName,
          companyRegistration: companyRegistration,
          businessType: businessType,
          address1: address1,
          address2: address2,
          address3: address3,
          postcode: postcode,
          city: city,
          state: state,
          picFirstName: picFirstName,
          picSecondName: picSecondName,
          phoneNumber: phoneNumber,
          email: email,
          idNumber: idNumber,
          totalLotRequired: totalLotRequired,
          reason: reason,
          lotNumber: lotNumber,
          location: location,
          designatedBayPicture: designatedBayPicture,
          registerNumberPicture: registerNumberPicture,
          idCardPicture: idCardPicture,
          createdAt: createdAt || new Date(),
        },
      });

      res.status(201).json({ status: "success", data: newReserveBay });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .put("/edit/:id", async (req, res) => {
    const { id } = req.params;
    const {
      userId,
      companyName,
      companyRegistration,
      businessType,
      address1,
      address2,
      address3,
      postcode,
      city,
      state,
      picFirstName,
      picSecondName,
      phoneNumber,
      email,
      idNumber,
      totalLotRequired,
      reason,
      lotNumber,
      location,
      designatedBayPicture,
      registerNumberPicture,
      idCardPicture,
      createdAt,
    } = req.body; // Data to update

    try {
      // Check if the monthly pass exists and belongs to the user
      const existingReserveBay = await client.reserveBay.findUnique({
        where: { id },
      });

      if (!existingReserveBay) {
        return res.status(404).json({
          error: "Reserve Bay not found.",
        });
      }

      // Update the monthly pass entry
      const updatedReserveBay = await client.reserveBay.update({
        where: { id },
        data: {
          userId: userId || existingReserveBay.userId,
          companyName: companyName || existingReserveBay.companyName,
          companyRegistration:
            companyRegistration || existingReserveBay.companyRegistration,
          businessType: businessType || existingReserveBay.businessType,
          address1: address1 || existingReserveBay.address1,
          address2: address2 || existingReserveBay.address2,
          address3: address3 || existingReserveBay.address3,
          postcode: postcode || existingReserveBay.postcode,
          city: city || existingReserveBay.city,
          state: state || existingReserveBay.state,
          picFirstName: picFirstName || existingReserveBay.picFirstName,
          picSecondName: picSecondName || existingReserveBay.picSecondName,
          phoneNumber: phoneNumber || existingReserveBay.phoneNumber,
          email: email || existingReserveBay.email,
          idNumber: idNumber || existingReserveBay.idNumber,
          totalLotRequired:
            totalLotRequired || existingReserveBay.totalLotRequired,
          reason: reason || existingReserveBay.reason,
          lotNumber: lotNumber || existingReserveBay.lotNumber,
          location: location || existingReserveBay.location,
          designatedBayPicture:
            designatedBayPicture || existingReserveBay.designatedBayPicture,
          registerNumberPicture:
            registerNumberPicture || existingReserveBay.registerNumberPicture,
          idCardPicture: idCardPicture || existingReserveBay.idCardPicture,
          createdAt: createdAt || existingReserveBay.createdAt,
        },
      });

      res.status(200).json({ status: "success", data: updatedReserveBay });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .delete("/delete/:id", async (req, res) => {
    const { id } = req.params; // The Reserve Bay ID from the URL parameter
    try {
      // Check if the reserve bay entry exists and belongs to the user
      const existingReserveBay = await client.reserveBay.findUnique({
        where: { id },
      });

      if (!existingReserveBay) {
        return res.status(404).json({
          error: "Reserve Bay not found.",
        });
      }

      // Delete the monthly pass entry
      await client.reserveBay.delete({
        where: { id },
      });

      res.status(200).json({
        status: "success",
        message: "Reserve Bay deleted successfully.",
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .put("/edit/status/:id", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Data to update

    try {
      // Check if the monthly pass exists and belongs to the user
      const existingReserveBay = await client.reserveBay.findUnique({
        where: { id },
      });

      if (!existingReserveBay) {
        return res.status(404).json({
          error: "Reserve Bay not found.",
        });
      }

      // Update the monthly pass entry
      const updatedReserveBay = await client.reserveBay.update({
        where: { id },
        data: {
          status: status || existingReserveBay.status,
        },
      });

      let notification;

      const reserveBay = await client.reserveBay.findUnique({
        where: { id },
      });

      if (!reserveBay) {
        return res.status(404).json({
          error: "Reserve Bay not found.",
        });
      }

      if (reserveBay.status === "APPROVED") {
        // give CCP App notification
        notification = await client.notification.create({
          data: {
            id: uuidv4(),
            title: "Reserve Bay",
            description:
              "Your Reserve Bay for " +
              existingReserveBay.companyRegistration +
              " status has been approved.",
            notifyTime: new Date(now()),
            userId: existingReserveBay.userId,
            reserveBayId: existingReserveBay.id,
          },
        });
      }

      if (reserveBay.status === "REJECTED") {
        // give CCP App notification
        notification = await client.notification.create({
          data: {
            id: uuidv4(),
            title: "Reserve Bay",
            notifyTime: new Date(now()),
            description:
              "Your Reserve Bay for " +
              existingReserveBay.companyRegistration +
              " status has been rejected.",
            userId: existingReserveBay.userId,
            reserveBayId: existingReserveBay.id,
          },
        });
      }

      res.status(200).json({
        status: "success",
        data: updatedReserveBay,
        notification: notification,
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

reservebayRouter.use(tokenMiddleware);

reservebayRouter
  .get("/", async (req, res) => {
    const userId = req.user.userId; // Assuming this is obtained via authentication middleware
    try {
      const reserveBays = await client.reserveBay.findMany({
        where: { userId },
      });
      res.status(200).json(reserveBays);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })

  .post("/create", async (req, res) => {
    const userId = req.user.userId;
    const id = uuidv4();
    try {
      const newReservebay = await client.reserveBay.create({
        data: {
          id,
          userId,
          ...req.body,
        },
      });
      res.status(201).json(newReservebay);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  })
  .post("/delete", async (req, res) => {
    try {
      const { reservedBayId } = req.body;
      const deleted = await client.reserveBay.delete({
        where: {
          id: reservedBayId,
        },
      });

      res.status(201).json(deleted);
    } catch (error) {
      logger.error(error);
      res.status(400).json({ error: error.message });
    }
  });

export default reservebayRouter;
