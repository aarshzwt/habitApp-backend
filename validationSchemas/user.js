const yup = require("yup");

// const userGetSchema = yup.object({
//   query: yup.object({
//     order: yup.string().oneOf(["ASC", "DESC"], 'order must be from ["ASC", "DESC"]').optional(),
//     col: yup.string().oneOf(['first_name', 'email', 'last_name', 'role', 'createdAt'], "column name must be from ['first_name', 'email', 'last_name', 'role', 'createdAt']").optional(),
//   })
// })

const userCreateSchema = yup.object({
  body: yup.object({
    username: yup.string().required("username is required"),
    email: yup.string().email("email is not in proper format").required("email is required"),
    password: yup.string().required("password is required"),
    role: yup.string().oneOf(['admin', 'user'], `role must be from ['admin', 'user']`).required("role is required"),
  }),
});

const userLoginSchema = yup.object({
  body: yup.object({
    email: yup.string().email("email is not in proper format").required("email is required"),
    password: yup.string().required("password is required"),
  }),
});


const userUpdateSchema = yup.object({
  body: yup.object({
    username: yup.string().required("username is required"),
    email: yup.string().email("email is not in proper format").required("email is required"),
    password: yup.string().optional(),
  }),
});

module.exports = { userCreateSchema, userLoginSchema, userUpdateSchema };
