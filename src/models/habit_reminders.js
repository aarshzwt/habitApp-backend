module.exports = (sequelize, DataTypes) => {
    const HabitReminder = sequelize.define('habitReminders', {
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
        habit_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'habits',
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
        tableName: 'habit_reminders',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return HabitReminder;
};
