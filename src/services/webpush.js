require('dotenv').config();
const webpush = require("web-push");

function configureVapid(app) {
    webpush.setVapidDetails(
        "mailto:admin@yourapp.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    app.set("webpush", webpush);
}

module.exports = configureVapid;
