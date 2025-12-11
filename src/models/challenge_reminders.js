module.exports = (sequelize, DataTypes) => {
    const ChallengeReminder = sequelize.define('challengeReminders', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
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
        challenge_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'challenges',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        sent: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            default: false
        },
        send_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        timestamps: true,
        tableName: 'challenge_reminders',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return ChallengeReminder;
};
