module.exports = (sequelize, DataTypes) => {
    const Badge = sequelize.define('badges', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
        },
        icon_url: {
            type: DataTypes.STRING(500),
        }
    }, {
        timestamps: true,
        tableName: 'badges',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });
    return Badge;
};
