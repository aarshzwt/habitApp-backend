module.exports = (sequelize, DataTypes) => {
    const ChallengeParticipants = sequelize.define('challenge_participants', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            autoIncrement: true,
            primaryKey: true,
        },
        challenge_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            refrences: {
                model: 'challenges',
                key: 'id',
            },
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            refrences: {
                model: 'users',
                key: 'id',
            },
        },
        start_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
        },
        end_date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('active', 'completed', 'failed', 'retracted'),
            allowNull: false,
            defaultValue: 'active',
        }
    }, {
        timestamps: true,
        tableName: 'challenge_participants',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return ChallengeParticipants;
};
