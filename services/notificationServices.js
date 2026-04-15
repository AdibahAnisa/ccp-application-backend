import client from "../utils/db.js";
import admin from "../utils/firebase.js";

export const sendNotification = async (userId, title, body) => {
  const user = await client.user.findUnique({
    where: { id: userId },
  });

  console.log("📱 User token:", user?.fcmToken);

  if (!user?.fcmToken) {
    console.log("❌ No FCM token found");
    return;
  }

  try {
    await admin.messaging().send({
      token: user.fcmToken,
      notification: {
        title,
        body,
      },
    });

    console.log("✅ Notification sent");
  } catch (error) {
    console.error("🔥 FCM error:", error.message);
  }
};
