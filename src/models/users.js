const bcrypt = require('bcrypt')

module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('users', {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            autoIncrement: true,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('admin', 'user'),
            allowNull: false,
        },
        currentXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        totalXP: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        level: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        timezone: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'UTC',
        },
        next_reset_at: {
            type: DataTypes.DATE,
            allowNull: true,
        }
    }, {
        timestamps: true,
        tableName: 'users',
        defaultScope: {
            attributes: {
                exclude: ['password', 'createdAt', 'updatedAt']
            }
        },
        hooks: {
            beforeCreate: async (user, options) => {
                if (user.password) {
                    user.password = await bcrypt.hash(user.password, 13);
                }
            },
            beforeUpdate: async (user, options) => {
                if (user.changed('password')) {
                    user.password = await bcrypt.hash(user.password, 13);
                }
            }
        },
        scopes: {
            //withPassword scope, necessary when login procedure 
            withPassword: {
                attributes: {
                    include: ['password']
                },
            }
        }
    });

    User.prototype.comparePassword = async function (password) {
        return bcrypt.compare(password, this.password);
    };

    return User;
};
