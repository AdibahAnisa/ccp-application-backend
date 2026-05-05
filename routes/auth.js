import express from "express";
import {
  generateToken,
  hashPassword,
  comparePasswords,
  tokenMiddleware,
  authenticateToken,
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
              id: uuidv4(),
              firstName: req.body.firstName,
              secondName: req.body.secondName,
              email: req.body.email,
              password: hashedPassword,
              phoneNumber: req.body.phoneNumber,
              idNumber: req.body.idNumber,
              address1: req.body.address1,
              address2: req.body.address2,
              address3: req.body.address3,
              postcode: req.body.postcode ? parseInt(req.body.postcode) : null,
              city: req.body.city,
              state: req.body.state,
              isDeleted: false,
            },
          });

          // Create a wallet for the new user
          await prisma.wallet.create({
            data: {
              id: uuidv4(),
              userId: newUser.id,
              walletAmount: 0,
            },
          });

          const token = generateToken({
            email: newUser.email,
            userId: newUser.id,
          });

          res.status(201).json({
            message: "User registered successfully",
            token,
            autoDeduct: newUser.autoDeduct,
            hasWallet: true,
          });
        });
      } catch (error) {
        console.error("SIGNUP ERROR 👉", error);
        res.status(500).json({ error: error.message });
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
        select: {
          id: true,
          email: true,
          password: true,
          autoDeduct: true,
          wallet: {
            select: {
              id: true,
              walletAmount: true,
            },
          },
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not exist" });
      }

      const isValid = comparePasswords(password, user.password);

      if (!user.password) {
        return res.status(500).json({ error: "User password not set" });
      }

      if (!isValid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Generate token
      const token = generateToken({ email, userId: user.id });
      res.status(200).json({
        message: "Login Success",
        token,
        autoDeduct: user.autoDeduct,
        hasWallet: !!user.wallet,
        hasWalletAmount: !!user.wallet?.walletAmount,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

authRouter.post("/save-wallet-token", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { walletAmount } = req.body;

    if (!walletAmount) {
      return res.status(400).json({ error: "Wallet token is required" });
    }

    await client.wallet.update({
      where: { userId: userId },
      data: {
        walletAmount: walletAmount,
      },
    });

    res.status(200).json({
      message: "Wallet token saved successfully",
    });
  } catch (error) {
    console.error("SAVE WALLET ERROR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/toggle-auto-deduct", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { autoDeduct } = req.body;

    const user = await client.user.update({
      where: { id: userId },
      data: { autoDeduct },
    });

    res.status(200).json({
      autoDeduct: user.autoDeduct,
    });
  } catch (error) {
    console.error("AUTO DEDUCT ERROR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.post("/save-fcm-token", authenticateToken, async (req, res) => {
  console.log("📩 USER FROM TOKEN:", req.user);
  console.log("📩 BODY:", req.body);

  try {
    const userId = req.user.userId;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: "FCM token is required" });
    }

    // 1. Remove this phone token from other users
    await client.user.updateMany({
      where: {
        fcmToken: fcmToken,
        NOT: {
          id: userId,
        },
      },
      data: {
        fcmToken: null,
      },
    });

    // 2. Save token only to current logged-in user
    await client.user.update({
      where: { id: userId },
      data: {
        fcmToken: fcmToken,
      },
    });

    res.status(200).json({
      message: "FCM token saved successfully",
    });
  } catch (error) {
    console.error("SAVE FCM ERROR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter
  .get("/user-profile", authenticateToken, async (req, res) => {
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
              walletAmount: true,
            },
          },
          plateNumber: {
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
      res.status(200).json({
        message: "Login Success",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          secondName: user.secondName,
          fullName: `${user.firstName} ${user.secondName}`,
          phoneNumber: user.phoneNumber,
          wallet: user.wallet,
          plateNumber: user.plateNumber,
        },
        autoDeduct: user.autoDeduct,
        hasWallet: !!user.wallet,
      });
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
          firstName: req.body.firstName ?? null,
          secondName: req.body.secondName ?? null,
          email: req.body.email ?? null,
          idNumber: req.body.idNumber || null,
          phoneNumber: req.body.phoneNumber || null,
          address1: req.body.address1 || null,
          address2: req.body.address2 || null,
          address3: req.body.address3 || null,
          city: req.body.city || null,
          state: req.body.state || null,

          postcode: req.body.postcode ? parseInt(req.body.postcode) : null,
        },

        include: {
          wallet: true,
          plateNumber: true,
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
