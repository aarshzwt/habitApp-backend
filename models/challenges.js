module.exports = (sequelize, DataTypes) => {
    const Challenge = sequelize.define('challenges', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
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
        duration_days: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        habit_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'habits',
                key: 'id',
            },
            onDelete: 'CASCADE',
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
        created_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        }
    }, {
        timestamps: true,
        tableName: 'challenges',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return Challenge;
};
