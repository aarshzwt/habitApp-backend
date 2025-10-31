module.exports = (sequelize, DataTypes) => {
    const HabitLog = sequelize.define('habitLogs', {
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
        date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        status: {
            type: DataTypes.ENUM('completed', 'remaining', 'missed'),
            allowNull: false,
            defaultValue: 'remaining',
        },
    }, {
        timestamps: true,
        tableName: 'habit_logs',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    // Habit.associate = (models) => {
    //     // Habit belongs to a User
    //     Habit.belongsTo(models.User, {
    //         foreignKey: 'user_id',
    //         onDelete: 'CASCADE',
    //     });

    //     // Habit has many HabitLogs
    //     Habit.hasMany(models.HabitLog, {
    //         foreignKey: 'habit_id',
    //         onDelete: 'CASCADE',
    //     });
    // };

    return HabitLog;
};
