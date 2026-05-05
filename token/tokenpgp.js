import axios from "axios";
import client from "../utils/db.js"; // Update this with the actual path to your Prisma client

let tokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: Math.floor(new Date().setDate(new Date().getDate() + 1) / 1000), // Set to tomorrow's timestamp
};

const TOKEN_EXPIRATION_TIME = 30 * 60 * 1000;
export function storeTokens(type) {
  return async (req, res, next) => {
    try {
      const token = await client.token.findFirst({
        where: { type },
        orderBy: { createdAt: "desc" },
      });

      if (!token) {
        return res.status(404).json({ error: "No tokens found" });
      }

      const now = Date.now();

      // 🔥 AUTO REFRESH TOKEN
      if (token.expiresIn && now >= token.expiresIn) {
        console.log("Token expired → refreshing...");

        const response = await axios.post(process.env.REFRESH_TOKEN, {
          refresh_token: token.refreshToken,
        });

        const newAccessToken = response.data.access_token;
        const newRefreshToken = response.data.refresh_token;

        await client.token.update({
          where: { id: token.id },
          data: {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: Date.now() + 30 * 60 * 1000, // 30 min
          },
        });

        req.accessToken = newAccessToken;
      } else {
        req.accessToken = token.accessToken;
      }

      req.refreshToken = token.refreshToken;

      next();
    } catch (error) {
      console.error("TOKEN ERROR:", error);
      return res.status(500).json({ error: "Token handling failed" });
    }
  };
}

export async function refreshTokens(oldToken) {
  try {
    const response = await axios.post(process.env.REFRESH_TOKEN, {
      refresh_token: oldToken.refreshToken,
    });

    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token;

    await client.token.update({
      where: { id: oldToken.id },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        createdAt: new Date(),
      },
    });

    console.log("Tokens refreshed and stored in the database");

    // Schedule the next token refresh
    scheduleTokenRefresh({
      ...oldToken,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Error refreshing tokens:", error);
  }
}

export function scheduleTokenRefresh(token) {
  const expiresIn = getExpiresIn(token.accessToken); // Implement this function based on your token structure
  const refreshTime = Math.max(0, expiresIn - 5 * 60 * 1000); // Refresh 5 minutes before expiry

  // Log the next refresh time
  const nextRefreshTime = Date.now() + refreshTime;
  console.log(
    "Token will be refreshed at:",
    new Date(nextRefreshTime).toLocaleString(),
  );

  setTimeout(() => refreshTokens(token), refreshTime);
}

export function getExpiresIn(accessToken) {
  // Decode the token and extract the expiration time
  // Assuming the token is a JWT and the expiration time is in the 'exp' claim
  const payload = JSON.parse(
    Buffer.from(accessToken.split(".")[1], "base64").toString(),
  );
  const exp = payload.exp * 1000; // Convert to milliseconds
  return exp - Date.now();
}

function refreshToken() {
  tokens.accessToken_refresh = refreshTokens();
  tokens.expiresAt = Date.now() + getExpiresIn;
  console.log("Token refreshed at:", new Date().toLocaleString());
  console.log("New access token:", tokens.accessToken_refresh);
  console.log("Expires at:", new Date(tokens.expiresAt).toLocaleString());
  console.log("-----------------------");

  return tokens.accessToken;
}

export function startRefreshLoop() {
  setInterval(() => {
    refreshToken();
  }, TOKEN_EXPIRATION_TIME);
}
