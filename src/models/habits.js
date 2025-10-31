module.exports = (sequelize, DataTypes) => {
    const Habit = sequelize.define('habits', {
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
        title: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        frequency_type: {
            type: DataTypes.ENUM('daily', 'every_x_days', 'x_times_per_week'), // e.g., 'daily', 'weekly'
            allowNull: false,
            defaultValue: 'daily',
        },
        frequency_value: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        frequency_days: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'categories',
                key: 'id',
            },
            onDelete: 'CASCADE',
            defaultValue: null,
        },
        template_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        is_archived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        start_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        end_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
            defaultValue: null,
        },
    }, {
        timestamps: true,
        tableName: 'habits',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return Habit;
};
