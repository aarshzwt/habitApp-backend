module.exports = (sequelize, DataTypes) => {
    const HabitTemplate = sequelize.define('habitTemplates', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        frequency_type: {
            type: DataTypes.ENUM('daily', 'every_x_days', 'x_times_per_week'),
            allowNull: false,
            defaultValue: 'daily',
        },
        frequency_value: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        frequency_days: {
            type: DataTypes.JSON,
            allowNull: true
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'categories',
                key: 'id',
            },
            onDelete: 'CASCADE',
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            // references: {
            //     model: 'users',
            //     key: 'id',
            // },
            // onDelete: 'CASCADE',
        }
    }, {
        timestamps: true,
        tableName: 'habit_templates',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return HabitTemplate;
};
