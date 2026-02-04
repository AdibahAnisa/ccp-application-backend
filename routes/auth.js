import express from "express";
import {
  generateToken,
  hashPassword,
  comparePasswords,
  tokenMiddleware,
} from "../utils/authUtils.js";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger.js";
import client from "../utils/db.js";

const authRouter = express.Router();

authRouter
  .get("/users", async (req, res) => {
    try {
      const users = await client.user.findMany({
        where: { isDeleted: false },
      });

      res.status(200).json(users);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ error: "Internal server error" });
    }
  })
  .patch("/restore/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const user = await client.user.findUnique({ where: { id } });

      if (!user || !user.isDeleted) {
        return res.status(404).json({
          error: "User not found or not deleted.",
        });
      }

      await client.user.update({
        where: { id },
        data: { isDeleted: false },
      });

      res.status(200).json({
        status: "success",
        message: "User successfully restored.",
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

authRouter
  .post("/signup", async (req, res) => {
    try {
      const { password, email, ...otherFields } = req.body;
      const userId = uuidv4();

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      // Check if the user with the same email exists
      const existing = await client.user.findFirst({
        where: { email },
      });

      if (existing) {
        if (!existing.isDeleted) {
          return res.status(400).json({ error: "Email already exists" });
        }

        // Reactivate the soft-deleted user
        try {
          await client.$transaction(async (prisma) => {
            const updatedUser = await prisma.user.update({
              where: { id: existing.id },
              data: {
                isDeleted: false,
                password: hashPassword(password),
                ...otherFields,
              },
            });

            const token = generateToken({
              email: updatedUser.email,
              userId: updatedUser.id,
            });

            res.status(200).json({
              message: "User reactivated successfully",
              token,
            });
          });
          return;
        } catch (error) {
          logger.error(error);
          return res.status(500).json({ error: "Internal server error" });
        }
      }

      // If no existing user, proceed with new registration
      const hashedPassword = hashPassword(password);

      try {
        await client.$transaction(async (prisma) => {
          const newUser = await prisma.user.create({
            data: {
              id: userId,
              email,
              password: hashedPassword,
              ...otherFields,
            },
          });

          // Create a wallet for the new user
          await prisma.wallet.create({
            data: {
              id: uuidv4(),
              userId: newUser.id,
              amount: 0,
            },
          });

          const token = generateToken({
            email: newUser.email,
            userId: newUser.id,
          });

          res.status(201).json({
            message: "User registered successfully",
            token,
          });
        });
      } catch (error) {
        logger.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    } catch (error) {
      logger.error(error);
      res.status(400).json({ error: error.message });
    }
  })
  .post("/signin", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const user = await client.user.findFirst({
        where: { email, isDeleted: false },
        select: { id: true, email: true, password: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not exist" });
      }

      const isValid = comparePasswords(password, user.password);

      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate token
      const token = generateToken({ email, userId: user.id });
      res.status(200).json({ message: "Login Success", token });
    } catch (error) {
      console.error("Error during sign-in:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

authRouter.use(tokenMiddleware);

authRouter
  .get("/user-profile", async (req, res) => {
    try {
      const user = await client.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          secondName: true,
          idNumber: true,
          phoneNumber: true,
          address1: true,
          address2: true,
          address3: true,
          city: true,
          state: true,
          postcode: true,
          wallet: {
            select: {
              amount: true,
            },
          },
          plateNumbers: {
            select: {
              id: true,
              plateNumber: true,
              isMain: true,
            },
          },
          reserveBays: true,
          transactions: true,
          helpdesks: true,
        },
      });
      res.status(200).json(user);
    } catch (error) {
      logger.error(error);
      return res.status(500).send({
        message: error.message,
        error: "Internal server error",
      });
    }
  })

  .put("/update", async (req, res) => {
    const userId = req.user.userId;

    try {
      const updatedUser = await client.user.update({
        where: { id: userId },
        data: {
          ...req.body,
        },
        include: {
          wallet: true,
          plateNumbers: true,
          reserveBays: true,
          transactions: true,
          helpdesks: true,
        },
      });

      res.status(201).json({
        message: "Update success",
        user: updatedUser,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .delete("/delete/:id", async (req, res) => {
    const { id } = req.params;

    try {
      // Check if the user exists
      const existingUser = await client.user.findUnique({
        where: { id },
      });

      if (!existingUser || existingUser.isDeleted) {
        return res.status(404).json({
          error: "User not found.",
        });
      }

      // Mark the user as deleted
      await client.user.update({
        where: { id },
        data: { isDeleted: true },
      });

      res.status(200).json({
        status: "success",
        message: "User successfully deleted.",
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

export default authRouter;
