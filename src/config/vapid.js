require("dotenv").config();
const webpush = require("web-push");

function getWebPush() {
    webpush.setVapidDetails(
        "mailto:admin@yourapp.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    return webpush;
}

module.exports = getWebPush;
