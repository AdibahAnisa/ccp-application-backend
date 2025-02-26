import express from "express";
import { tokenMiddleware } from "../utils/authUtils.js";
import client from "../utils/db.js";
import { v4 as uuidv4, validate } from "uuid";
import logger from "../utils/logger.js";
import axios from "axios";

const paymentRouter = express.Router();

paymentRouter
  .post("/public/pay-key", async (req, res) => {
    const { onboarding_key, connection_type } = req.body;

    // Replace hardcoded values with the ones from the request body
    const key = {
      onboarding_key: onboarding_key,
      connection_type: connection_type,
    };

    console.log("Onboarding:", key);

    const onboardingAPI = process.env.ONBOARDING_API;
    console.log("Payment API URL:", onboardingAPI);

    try {
      const response = await axios.post(onboardingAPI, key, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Check if the status is not in the range of 2xx
      if (response.status !== 200) {
        console.error("API Response Error:", response.data);
        return res.status(response.status).json({
          error: "Failed to generate token & refresh code",
          details: response.data,
        });
      }

      const { access_token, refresh_token } = response.data;

      await client.token.create({
        data: {
          type: "QR Pegepay",
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresIn: 1800,
        },
      });

      const responseData = response.data;
      console.log(responseData);

      tokens.expiresAt = Date.now() + TOKEN_EXPIRATION_TIME;
      console.log("Expires at:", new Date(tokens.expiresAt).toLocaleString());
      // Save the tokens to the database

      // Success: Send the response data back to the client
      res.status(200).json(response.data);
    } catch (error) {
      if (error.response) {
        // Server responded with a status code out of the range of 2xx
        console.error("Error status:", error.response.status);
        console.error("Error data:", error.response.data);
        return res.status(error.response.status).json({
          error: "Failed to generate token & refresh code",
          details: error.response.data,
        });
      } else if (error.request) {
        // Request was made but no response received
        console.error("Error request:", error.request);
        return res
          .status(500)
          .json({ error: "No response from the payment API" });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("Error message:", error.message);
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  })
  .post("/public/refresh-token", async (req, res) => {
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
        return res.status(404).json({ error: "No tokens found" });
      }

      // Set the tokens in the request object
      const accessToken = token.accessToken;
      const refreshToken = token.refreshToken;

      console.log("Request Access Token:", accessToken);
      console.log("Request Refresh Token:", refreshToken);

      if (!refreshToken) {
        return res.status(400).json({ error: "Refresh token is required" });
      }

      const refresh_Token = {
        refresh_token: refreshToken,
      };

      console.log("Request Body:", refresh_Token);

      const refresh_token_url = process.env.REFRESH_TOKEN;
      try {
        const response = await axios.post(refresh_token_url, refresh_Token, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.status !== 200) {
          console.error("API Response Error:", response.data);
          return res.status(response.status).json({
            error: "Failed to generate token & refresh code",
            details: response.data,
          });
        }

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token;

        // Update the token in the database
        await client.token.update({
          where: {
            id: token.id,
          },
          data: {
            accessToken: newAccessToken,
            // Replace old accessToken with new refreshToken
          },
        });

        return res.status(200).json(response.data);
      } catch (error) {
        console.error(
          "Fetch Error:",
          error.response ? error.response.data : error.message,
        );
        return res.status(500).json({
          error: "Internal server error",
          details: error.response ? error.response.data : null,
        });
      }
    } catch (error) {
      console.error("Database error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  })
  .get("/public/token", async (req, res) => {
    try {
      const token = await client.token.findFirst({
        where: {
          type: "QR Pegepay",
        },
        orderBy: {
          createdAt: "desc",
        },
      });
      res.status(200).json({
        accessToken: token.accessToken,
        token_expired_at: token.expiresIn,
      });
    } catch (error) {
      logger.error(error);
      return res.status(500).send(error);
    }
  })
  .post("/public/generate-qr", storeTokens, async (req, res) => {
    const {
      order_output,
      order_number,
      validity_qr,
      order_amount,
      store_id,
      terminal_id,
      shift_id,
      to_whatsapp_no,
    } = req.body;
    console.log("Request Body:", req.body);

    let { accessToken } = req; // Current access token
    console.log("Access Token:", accessToken);

    const qr_body = {
      order_output: order_output,
      order_no: order_number,
      override_existing_unprocessed_order_no: "NO",
      order_amount: order_amount,
      qr_validity: validity_qr, //store in env
      store_id: store_id,
      terminal_id: terminal_id,
      shift_id: shift_id,
      to_whatsapp_no: to_whatsapp_no, //store in env
      language: "en_us",
      whatsapp_template_id: "payment_qr",
      parameters: [
        { text: "Faizal" },
        { text: "8888888" },
        { text: "1" },
        { text: "4" },
        { text: "RM1400" },
      ],
    };

    console.log("QR Body:", qr_body);

    const paymentApi = process.env.PAYMENT_API;
    console.log("Payment API URL:", paymentApi);

    try {
      const response = await axios.post(paymentApi, qr_body, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      console.log("API Response:", response.data);

      if (response.status !== 200) {
        console.error("API Response Error:", response.data);
        return res.status(response.status).json({
          error: "Failed to generate QR code",
          details: response.data,
        });
      }

      req.accessToken = response.data.access_token;
      req.refreshToken = response.data.refresh_token;

      // Set an interval to refresh the token every 10 minutes
      const refreshInterval = 10 * 60 * 1000; // 10 minutes in milliseconds
      setTimeout(async () => {
        try {
          const refreshResponse = await axios.post(
            `${process.env.BASE_URL}:${process.env.PORT}/payment/refresh-token`,
            {},
            {
              headers: {
                Authorization: `Bearer ${accessToken}`, // Use the current token
              },
            },
          );

          if (refreshResponse.status === 200) {
            console.log("Token refreshed successfully:", refreshResponse.data);

            // Update access token for future requests
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
      }, refreshInterval);

      // Success: Send the response data back to the client
      res.status(200).json({ data: response.data, order: qr_body });
    } catch (error) {
      console.error(
        "Fetch Error:",
        error.response ? error.response.data : error.message,
      );
      return res.status(500).json({
        error: "Internal server error",
        details: error.response ? error.response.data : null,
      });
    }
  });

paymentRouter.use(tokenMiddleware);

let tokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: Math.floor(new Date().setDate(new Date().getDate() + 1) / 1000), // Set to tomorrow's timestamp
};

const TOKEN_EXPIRATION_TIME = 30 * 60 * 1000;
paymentRouter.post("/pay-key", async (req, res) => {
  const { onboarding_key, connection_type } = req.body;

  // Replace hardcoded values with the ones from the request body
  const key = {
    onboarding_key: onboarding_key,
    connection_type: connection_type,
  };

  console.log("Onboarding:", key);

  const onboardingAPI = process.env.ONBOARDING_API;
  console.log("Payment API URL:", onboardingAPI);

  try {
    const response = await axios.post(onboardingAPI, key, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Check if the status is not in the range of 2xx
    if (response.status !== 200) {
      console.error("API Response Error:", response.data);
      return res.status(response.status).json({
        error: "Failed to generate token & refresh code",
        details: response.data,
      });
    }

    const { access_token, refresh_token } = response.data;

    await client.token.create({
      data: {
        type: "QR Pegepay",
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: 1800,
      },
    });

    const responseData = response.data;
    console.log(responseData);

    tokens.expiresAt = Date.now() + TOKEN_EXPIRATION_TIME;
    console.log("Expires at:", new Date(tokens.expiresAt).toLocaleString());
    // Save the tokens to the database

    // Success: Send the response data back to the client
    res.status(200).json(response.data);
  } catch (error) {
    if (error.response) {
      // Server responded with a status code out of the range of 2xx
      console.error("Error status:", error.response.status);
      console.error("Error data:", error.response.data);
      return res.status(error.response.status).json({
        error: "Failed to generate token & refresh code",
        details: error.response.data,
      });
    } else if (error.request) {
      // Request was made but no response received
      console.error("Error request:", error.request);
      return res
        .status(500)
        .json({ error: "No response from the payment API" });
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error("Error message:", error.message);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
});

async function storeTokens(req, res, next) {
  try {
    const token = await client.token.findFirst({
      where: {
        type: "QR Pegepay",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    req.accessToken = token.accessToken;
    req.refreshToken = token.refreshToken;
    next();
    if (!token) {
      return res.status(404).json({ error: "No tokens found" });
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

paymentRouter.post("/refresh-token", async (req, res) => {
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
      return res.status(404).json({ error: "No tokens found" });
    }

    // Set the tokens in the request object
    const accessToken = token.accessToken;
    const refreshToken = token.refreshToken;

    console.log("Request Access Token:", accessToken);
    console.log("Request Refresh Token:", refreshToken);

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const refresh_Token = {
      refresh_token: refreshToken,
    };

    console.log("Request Body:", refresh_Token);

    const refresh_token_url = process.env.REFRESH_TOKEN;
    try {
      const response = await axios.post(refresh_token_url, refresh_Token, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status !== 200) {
        console.error("API Response Error:", response.data);
        return res.status(response.status).json({
          error: "Failed to generate token & refresh code",
          details: response.data,
        });
      }

      const newAccessToken = response.data.access_token;
      const newRefreshToken = response.data.refresh_token;

      // Update the token in the database
      await client.token.update({
        where: {
          id: token.id,
        },
        data: {
          accessToken: newAccessToken,
          // Replace old accessToken with new refreshToken
        },
      });

      return res.status(200).json(response.data);
    } catch (error) {
      console.error(
        "Fetch Error:",
        error.response ? error.response.data : error.message,
      );
      return res.status(500).json({
        error: "Internal server error",
        details: error.response ? error.response.data : null,
      });
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

paymentRouter.post("/transaction-details", async (req, res) => {
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
      return res.status(404).json({ error: "No tokens found" });
    }

    // Set the tokens in the request object
    const accessToken = token.accessToken;

    // return res.status(200).json(accessToken);

    // Use correct environment variable for the Pegepay API URL
    const pegeypay_process_url = process.env.PEGEPAY_PROCESS_API;

    try {
      // Send the request to the Pegepay API
      const response = await axios.post(pegeypay_process_url, req.body, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status !== 200) {
        console.error("API Response Error:", response.data);
        return res.status(response.status).json({
          error: "Failed to generate token & refresh code",
          details: response.data,
        });
      }

      // Return the successful response from the Pegepay API
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(
        "Fetch Error:",
        error.response ? error.response.data : error.message,
      );
      return res.status(500).json({
        error: "Internal server error",
        details: error.response ? error.response.data : null,
      });
    }
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

paymentRouter.post("/generate-qr", storeTokens, async (req, res) => {
  const {
    order_output,
    order_number,
    validity_qr,
    order_amount,
    store_id,
    terminal_id,
    shift_id,
    to_whatsapp_no,
  } = req.body;
  console.log("Request Body:", req.body);

  let { accessToken } = req; // Current access token
  console.log("Access Token:", accessToken);

  function generateRandomId() {
    return Math.random().toString(36).slice(2);
  }

  const qr_body = {
    order_output: order_output,
    order_no: order_number,
    override_existing_unprocessed_order_no: "NO",
    order_amount: order_amount,
    qr_validity: validity_qr, //store in env
    store_id: store_id,
    terminal_id: terminal_id,
    shift_id: shift_id,
    to_whatsapp_no: to_whatsapp_no, //store in env
    language: "en_us",
    whatsapp_template_id: "payment_qr",
    parameters: [
      { text: "Faizal" },
      { text: "8888888" },
      { text: "1" },
      { text: "4" },
      { text: "RM1400" },
    ],
  };

  console.log("QR Body:", qr_body);

  const paymentApi = process.env.PAYMENT_API;
  console.log("Payment API URL:", paymentApi);

  try {
    const response = await axios.post(paymentApi, qr_body, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("API Response:", response.data);

    if (response.status !== 200) {
      console.error("API Response Error:", response.data);
      return res.status(response.status).json({
        error: "Failed to generate QR code",
        details: response.data,
      });
    }

    req.accessToken = response.data.access_token;
    req.refreshToken = response.data.refresh_token;

    // Set an interval to refresh the token every 10 minutes
    const refreshInterval = 10 * 60 * 1000; // 10 minutes in milliseconds
    setTimeout(async () => {
      try {
        const refreshResponse = await axios.post(
          `${process.env.BASE_URL}:${process.env.PORT}/payment/refresh-token`,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`, // Use the current token
            },
          },
        );

        if (refreshResponse.status === 200) {
          console.log("Token refreshed successfully:", refreshResponse.data);

          // Update access token for future requests
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
    }, refreshInterval);

    // Success: Send the response data back to the client
    res.status(200).json({ data: response.data, order: qr_body });
  } catch (error) {
    console.error(
      "Fetch Error:",
      error.response ? error.response.data : error.message,
    );
    return res.status(500).json({
      error: "Internal server error",
      details: error.response ? error.response.data : null,
    });
  }
});

paymentRouter.post("/pegepay/qr/callback", async (req, res) => {
  const {
    order_no,
    order_amount,
    order_status,
    store_id,
    shift_id,
    terminal_id,
  } = req.body;
  try {
    const payment = await client.paymentTransaction.update({
      where: {
        id: order_no,
      },
      data: {
        status: "SUCCESS",
      },
    });

    let description;
    switch (payment.type) {
      case "COMPOUND":
        description = "Compound Payment";
        break;
      case "SEASON_PASS":
        description = "Season Pass";
        break;
      default:
        description = "UNKNOWN";
        break;
    }

    if (payment.id) {
      if (payment.type === "TOPUP") {
        // TODO: insert to wallet transaction table
      } else {
        // TODO: insert to transaction table
      }
    }

    if (!payment) {
      return res
        .status(404)
        .json({ error: "Transaction record not found, wrong transaction id" });
    }
  } catch (error) { }
});

paymentRouter.post("/topup-wallet", async (req, res) => {
  try {
    const { amount } = req.body;

    if (typeof amount === "number") {
      amount.toString();
    }
    await client.$transaction(async (prisma) => {
      const walletTransaction = await prisma.walletTransaction.create({
        data: {
          id: uuidv4(),
          amount: amount,
          type: "INCREMENT",
          status: "SUCCESS",
          wallet: {
            connect: {
              userId: req.user.userId,
            },
          },
        },
      });

      if (walletTransaction.id) {
        const updateWallet = await prisma.wallet.update({
          where: {
            userId: req.user.userId,
          },
          data: {
            amount: {
              increment: amount,
            },
          },
        });

        if (!updateWallet) {
          throw new Error("Failed to update wallet");
        }

        res.status(200).json({
          walletTransactionid: walletTransaction.id, //return wallet transaction id
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

paymentRouter.post("/parking", async (req, res) => {
  const userId = req.user.userId;
  let { amount } = req.body;

  console.log("Request body:", req.body);

  // Ensure amount is a string
  if (typeof amount !== "string") {
    amount = amount.toString();
  }

  try {
    // Perform the transaction
    await client.$transaction(async (prisma) => {
      const walletBalance = await prisma.wallet.findUnique({
        where: { userId: userId },
        select: { amount: true },
      });

      if (walletBalance.amount < parseFloat(amount)) {
        throw new Error("Insufficient balance");
      }

      const walletTransaction = await prisma.walletTransaction.create({
        data: {
          id: uuidv4(),
          amount: parseFloat(amount),
          type: "DECREMENT",
          status: "SUCCESS",
          wallet: {
            connect: {
              userId: userId,
            },
          },
        },
      });

      if (walletTransaction.id) {
        const updateWallet = await prisma.wallet.update({
          where: {
            userId: req.user.userId,
          },
          data: {
            amount: {
              decrement: parseFloat(amount),
            },
          },
        });

        if (!updateWallet) {
          throw new Error("Failed to update wallet");
        }

        res.status(200).json({
          walletTransactionid: walletTransaction.id, //return wallet transaction id
        });
      }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

paymentRouter.get("/wallet-transaction", async (req, res) => {
  const userId = req.user.userId;
  try {
    const wallet = await client.wallet.findUnique({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        amount: true,
      },
    });

    if (!wallet) {
      return res.status(404).json({ error: "wallet not found" });
    }

    const transactions = await client.walletTransaction.findMany({
      where: {
        walletId: wallet.id,
      },
      select: {
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    console.log(transactions);
    res.status(200).json(transactions);
  } catch (error) {
    logger.error(error);
    return res.status(500).send(error);
  }
});

paymentRouter.post("/callbackUrl/pegeypay", async (req, res) => {
  const payload = req.body;

  if (!validatePayload(payload)) {
    return res.status(400).send("Invalid payload");
  }

  // Process the payment notification
  if (payload.order_status === "paid") {
    await handlePaymentSuccess(payload);
    try {
      const updatedTransaction = await client.paymentTransaction.create({
        data: {
          id: uuidv4(),
          userId: req.user.userId,
          order_amount: payload.order_amount,
          order_no: payload.order_no,
          order_status: payload.order_status,
          store_id: payload.store_id,
          shift_id: payload.shift_id,
          terminal_id: payload.terminal_id,
          updatedAt: new Date(),
        },
      });

      console.log("Transaction updated:", updatedTransaction);

      // Check if shift_id is "Token"
      if (payload.store_id == "Token") {
        // Get walletId from the Wallet model using userId
        const wallet = await client.wallet.findUnique({
          where: { userId: req.user.userId },
        });

        if (wallet) {
          // Create a WalletTransaction
          const walletTransaction = await client.walletTransaction.create({
            data: {
              id: uuidv4(),
              walletId: wallet.id, // Use the walletId from the found wallet
              type: "Topup",
              amount: payload.order_amount,
              status: "completed",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          console.log("WalletTransaction created:", walletTransaction);

          // Update the Wallet amount
          const updatedWallet = await client.wallet.update({
            where: { id: wallet.id },
            data: {
              amount: { increment: payload.order_amount },
            },
          });

          console.log("Wallet updated:", updatedWallet);
        } else {
          console.error("Wallet not found for user:", req.user.userId);
        }
      } else {
        const transaction = await client.transaction.create({
          data: {
            id: uuidv4(),
            userId: req.user.userId,
            description: payload.shift_id,
            pbtId: payload.terminal_id,
            amount: payload.order_amount.toString(),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log("Transaction created:", transaction);
      }
    } catch (error) {
      console.error("Error updating transaction:", error);
    }
  }

  res.status(200).send(payload);
});

function validatePayload(payload) {
  // Implement your validation logic here
  return (
    payload.order_no &&
    payload.order_amount &&
    payload.store_id &&
    payload.shift_id &&
    payload.terminal_id
  );
}

async function handlePaymentSuccess(payload) {
  console.log("Payment successful for order:", payload.order_no);
  console.log("Amount:", payload.order_amount);
  console.log("Store ID:", payload.store_id);
  console.log("Shift ID:", payload.shift_id);
  console.log("Terminal ID:", payload.terminal_id);
}

export default paymentRouter;
