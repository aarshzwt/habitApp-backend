module.exports = (sequelize, DataTypes) => {
    const Category = sequelize.define('categories', {
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
        image: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        // template_id: {
        //     type: DataTypes.INTEGER,
        //     allowNull: true
        // },
    }, {
        timestamps: true,
        tableName: 'categories',
        defaultScope: {
            attributes: {
                exclude: ['createdAt', 'updatedAt']
            }
        }
    });

    return Category;
};
