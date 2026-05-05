import client from "../utils/db.js";

export const confirmParking = async (req, res) => {
  try {
    const { plateNumber, hours } = req.body;
    const userId = req.user.userId;

    const user = await client.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    const walletAmount = Number(user.wallet?.walletAmount || 0);
    const requiredAmount = hours * 0.65;
    const autoDeduct = user.autoDeduct;

    let type;

    if ((!user.wallet || walletAmount < requiredAmount) && !autoDeduct) {
      return res.json({ success: false, type: "NO_WALLET_AND_AUTO_OFF" });
    }

    if (!user.wallet || walletAmount < requiredAmount) {
      return res.json({ success: false, type: "NO_WALLET" });
    }

    if (!autoDeduct) {
      return res.json({ success: false, type: "AUTO_OFF" });
    }

    // ✅ deduct
    await client.wallet.update({
      where: { id: user.wallet.id },
      data: {
        walletAmount: walletAmount - requiredAmount,
      },
    });

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + hours * 60 * 60 * 1000);

    return res.json({
      success: true,
      type: "AUTO_PAID",
      plateNumber,
      startTime,
      endTime,
      amount: requiredAmount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
