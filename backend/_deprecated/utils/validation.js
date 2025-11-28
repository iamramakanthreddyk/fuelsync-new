
const Joi = require('joi');

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required()
});

const registrationSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('Super Admin', 'Pump Owner', 'Manager', 'Employee').default('Employee')
});

const uploadSchema = Joi.object({
  originalname: Joi.string().required(),
  mimetype: Joi.string().pattern(/^image\//).required(),
  size: Joi.number().max(10 * 1024 * 1024).required() // 10MB max
});

const validateLogin = (data) => loginSchema.validate(data);
const validateRegistration = (data) => registrationSchema.validate(data);
const validateUpload = (file) => uploadSchema.validate(file);

module.exports = {
  validateLogin,
  validateRegistration,
  validateUpload
};
