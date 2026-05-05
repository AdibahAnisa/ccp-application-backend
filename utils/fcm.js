import axios from "axios";

export const sendFCM = async (accessToken, fcmToken, data) => {
  try {
    const response = await axios.post(
      "https://fcm.googleapis.com/v1/projects/city-car-park-e29de/messages:send",
      {
        message: {
          token: fcmToken,
          data: data,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );

    console.log("✅ FCM sent:", response.data);
  } catch (error) {
    console.error("❌ FCM error:", error.response?.data || error.message);
  }
};
