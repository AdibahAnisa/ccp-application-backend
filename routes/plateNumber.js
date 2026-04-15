import express from "express";
import { tokenMiddleware } from "../utils/authUtils.js";
import logger from "../utils/logger.js";
import { v4 as uuid } from "uuid";
import client from "../utils/db.js";

const plateNumberRouter = express.Router();
plateNumberRouter.use(tokenMiddleware);

plateNumberRouter
  .get("/", async (req, res) => {
    try {
      const user = await client.plateNumber.findMany({
        where: {
          userId: req.user.userId,
        },
      });

      res.status(200).json(user);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .post("/create", async (req, res) => {
    const { plateNumber, isMain } = req.body;
    const userId = req.user.userId;

    try {
      const user = await client.user.findUnique({
        where: { id: userId },
        include: { plateNumber: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const mainPlate = user.plateNumber.find((plate) => plate.isMain);

      if (isMain && mainPlate) {
        await client.plateNumber.update({
          where: { id: mainPlate.id },
          data: { isMain: false },
        });
      }

      const newPlateNumber = await client.plateNumber.create({
        data: {
          id: uuid(),
          userId,
          plateNumber,
          isMain,
        },
      });

      res.status(201).json(newPlateNumber);
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  })
  .put("/update/:id", async (req, res) => {
    const id = req.params.id;
    const { isMain } = req.body;
    const userId = req.user.userId;
    try {
      // First, reset all other plates to isMain: false
      if (isMain) {
        await client.plateNumber.updateMany({
          where: {
            userId,
            isMain: true,
          },
          data: {
            isMain: false,
          },
        });
      }

      // Now set the selected plate to isMain: true
      await client.plateNumber.update({
        where: {
          id,
          userId,
        },
        data: {
          isMain,
        },
      });
      res.status(200).json({ message: "Update success" });
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  })
  .post("/delete/:id", async (req, res) => {
    const id = req.params.id;
    try {
      await client.plateNumber.delete({
        where: {
          id,
          userId: req.user.userId,
        },
      });
      res.status(200).json({ message: "Delete success" });
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error.message);
    }
  });

export default plateNumberRouter;
