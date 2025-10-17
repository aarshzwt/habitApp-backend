module.exports = (sequelize, DataTypes) => {
    const UserBadges = sequelize.define('userBadges', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        badge_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'badges',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        earned_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        }
    }, {
        timestamps: true,
        tableName: 'user_badges'
    });

    return UserBadges;
};
