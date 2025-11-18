const db = require("../models");

async function notification(req, res) {
  const { user_id, endpoint, keys } = req.body;

  try {
    const [subscription, created] = await db.subscriptions.findOrCreate({
      where: { user_id, endpoint },
      defaults: {
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    });

    // If it already exists, you might want to update keys if they changed
    if (!created) {
      await subscription.update({
        p256dh: keys.p256dh,
        auth: keys.auth
      });
    }

    return res.json({ success: true, created });
  } catch (err) {
    console.error("Error saving subscription:", err);
    return res.status(500).json({ error: "server error" });
  }
}

module.exports = { notification };
