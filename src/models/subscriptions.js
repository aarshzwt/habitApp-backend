module.exports = (sequelize, DataTypes) => {
    const Subscription = sequelize.define("Subscription", {
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        endpoint: { type: DataTypes.STRING, allowNull: false },
        p256dh: { type: DataTypes.STRING, allowNull: false },
        auth: { type: DataTypes.STRING, allowNull: false }
    });

    return Subscription;
};
