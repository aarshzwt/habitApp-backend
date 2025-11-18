module.exports = (sequelize, DataTypes) => {
    const ChallengeLogs = sequelize.define('challenge_logs', {
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
        tableName: 'challenge_logs',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return ChallengeLogs;
};
