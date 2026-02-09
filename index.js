import "dotenv/config";
import express from "express";
import authRouter from "./routes/auth.js";
import reservebayRouter from "./routes/reservebay.js";
import transactionRouter from "./routes/transaction.js";
import carplatenumRouter from "./routes/plateNumber.js";
import pbtRouter from "./routes/pbt.js";
import walletRouter from "./routes/wallet.js";
import paymentRouter from "./routes/payment.js";
import helpDeskRouter from "./routes/helpdesk.js";
import logger from "./utils/logger.js";
import { checkDbConnection } from "./utils/db.js";
import bodyParser from "body-parser";
import client from "./utils/db.js";
import { errorHandler } from "./middleware/errorHandler.js";
import compoundRouter from "./routes/compound.js";
import paymentfpxRouter from "./routes/paymentfpx.js";
import monthlyPassRoute from "./routes/monthlyPass.js";
import forgetPasswordRouter from "./routes/forgetPassword.js";
import parkingRouter from "./routes/parking.js";
import promotionRouter from "./routes/promotionsMonthlyPass.js";
import notificationRouter from "./routes/notification.js";
import axios from "axios";

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(errorHandler);
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000,
  }),
);

app.use("/auth", authRouter);
app.use("/reservebay", reservebayRouter);
app.use("/transaction", transactionRouter);
app.use("/carplatenumber", carplatenumRouter);
app.use("/pbt", pbtRouter);
app.use("/wallet", walletRouter);
app.use("/payment", paymentRouter);
app.use("/helpdesk", helpDeskRouter);
app.use("/compound", compoundRouter);
app.use("/paymentfpx", paymentfpxRouter);
app.use("/monthlyPass", monthlyPassRoute);
app.use("/forgot-password", forgetPasswordRouter);
app.use("/parking", parkingRouter);
app.use("/promotion", promotionRouter);
app.use("/notification", notificationRouter);

const startupTime = new Date();

// Set an interval to refresh the token every 10 minutes
let accessToken;

// Function to refresh token
const refreshToken = async () => {
  try {
    // Fetch the most recent token from the database
    const token = await client.token.findFirst({
      where: {
        type: "QR Pegepay",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!token) {
      console.error("No tokens found");
      return;
    }

    // Use the current token
    accessToken = token.accessToken;

    // Send a request to refresh the token
    const refreshResponse = await axios.post(
      `${process.env.BASE_URL}:${process.env.PORT}/payment/public/refresh-token`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (refreshResponse.status === 200) {
      console.log("Token refreshed successfully:", refreshResponse.data);

      // Update the access token for future requests
      accessToken = refreshResponse.data.access_token;
    } else {
      console.error("Failed to refresh token:", refreshResponse.data);
    }
  } catch (error) {
    console.error(
      "Refresh Token Fetch Error:",
      error.response ? error.response.data : error.message,
    );
  }
};

// Set an interval to refresh the token every 10 minutes
const refreshInterval = 10 * 60 * 1000; // 10 minutes in milliseconds
setInterval(refreshToken, refreshInterval);

import jwt from "jsonwebtoken";

export const generateToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
};

app.get("/health", async (_req, res) => {
  try {
    await client.user.findFirst();
  } catch (error) {
    return res.status(500).json({
      status: `Failed database initialization check with error: ${error?.message}`,
      time: new Date(),
      startupTime,
    });
  }
  return res.json({
    status: "healthy",
    time: new Date(),
    startupTime,
  });
});

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  checkDbConnection();
});

export default app;
