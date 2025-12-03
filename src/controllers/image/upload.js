import { sendTelegramNotification } from "../../lib/telegramNotifier.js";

/**
 * Upload image to imgbb
 * Takes base64 image, uploads to imgbb, and sends Telegram notification in background
 */
export const uploadImage = async (req, res) => {
  try {
    const { image, email, username, referCode } = req.body;

    // Validate required fields
    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Image (base64) is required",
      });
    }

    // Validate base64 format
    let base64Data = image;
    if (image.startsWith("data:image")) {
      // Remove data URL prefix if present
      base64Data = image.split(",")[1];
    }

    // Validate base64 string is not empty
    if (!base64Data || base64Data.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Image data is empty",
      });
    }

    // Get imgbb API key from environment
    const imgbbApiKey = process.env.IMGBB_API_KEY;
    if (!imgbbApiKey) {
      return res.status(500).json({
        success: false,
        message: "Image upload service not configured",
      });
    }

    // Create URL-encoded form data (matching Python aiohttp format)
    // imgbb accepts base64 string directly in the "image" field
    const formData = new URLSearchParams();
    formData.append("key", imgbbApiKey);
    formData.append("image", base64Data);

    // Upload to imgbb
    const imgbbResponse = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!imgbbResponse.ok) {
      const errorText = await imgbbResponse.text();
      console.error("ImgBB upload error:", errorText);
      return res.status(500).json({
        success: false,
        message: "Failed to upload image to imgbb",
      });
    }

    const imgbbData = await imgbbResponse.json();

    // Check if imgbb returned success
    if (!imgbbData.success || !imgbbData.data || !imgbbData.data.url) {
      return res.status(500).json({
        success: false,
        message: "Image upload failed",
        error: imgbbData.error?.message || "Unknown error",
      });
    }

    const uploadedImageUrl = imgbbData.data.url;

    // Send Telegram notification in background (non-blocking)
    // This runs regardless of success/failure and doesn't block the response
    sendTelegramNotification(uploadedImageUrl, email || null, referCode || null);

    // Return success response
    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        url: uploadedImageUrl,
        deleteUrl: imgbbData.data.delete_url || null,
      },
    });
  } catch (error) {
    console.error("Error uploading image:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
};

