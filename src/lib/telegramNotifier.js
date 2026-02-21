/**
 * Telegram Notifier
 * Sends notifications to Telegram group
 * Runs as background task with low priority
 */

/**
 * Send notification to Telegram group in background
 * @param {string} imageUrl - The uploaded image URL
 * @param {string|null} email - User email (optional)
 * @param {string|null} referCode - Referral code (optional)
 */
export const sendTelegramNotification = async (imageUrl, email = null, referCode = null) => {
  // Run in background - don't await, don't block
  setImmediate(async () => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (!botToken || !chatId) {
        console.log("Telegram notifications disabled (missing bot_token or chat_id)");
        return;
      }

      // Build message
      let message = `🖼️ <b>Image Uploaded</b>\n\n`;
      message += `📷 <b>Image URL:</b>\n<code>${imageUrl}</code>\n\n`;
      message += `📱 <b>Uploaded by:</b> FaceGPT App\n`;

      if (email) {
        message += `👤 <b>User Email:</b> ${email}\n`;
      }

      if (referCode) {
        message += `🎁 <b>Refer Code:</b> ${referCode}\n`;
      }

      // Send to Telegram
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`Failed to send Telegram notification: ${response.statusText}`);
      }
    } catch (error) {
      // Silently fail - don't log errors for background notifications
      console.warn(`Telegram notification error: ${error.message}`);
    }
  });
};

/**
 * Send "new user created" to boss (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)
 * Short, clean, non-technical
 */
export const sendUserCreatedToBoss = (email, name, appname = null) => {
  setImmediate(async () => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;
      if (!botToken || !chatId) return;

      const appLine = appname ? `\n📱 App: ${appname}` : "";
      const message = `✅ New user signed up!${appLine}\n👤 ${name || "—"}\n📧 ${email}`;

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
    } catch (e) {
      console.warn(`Telegram boss notification error: ${e.message}`);
    }
  });
};

/**
 * Send error to backend dev channel (TELEGRAM_BOT_TOKEN_backend + TELEGRAM_CHAT_ID_backend)
 */
export const sendBackendErrorToDev = (context, errorMessage) => {
  setImmediate(async () => {
    try {
      const botToken = process.env.TELEGRAM_BOT_TOKEN_backend;
      const chatId = process.env.TELEGRAM_CHAT_ID_backend;
      if (!botToken || !chatId) return;

      const message = `⚠️ ${context}`;

      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message }),
      });
    } catch (e) {
      console.warn(`Telegram backend notification error: ${e.message}`);
    }
  });
};

