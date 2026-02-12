import joi from 'joi';

// Schema para login
const loginSchema = joi.object({
  email: joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    
  password: joi.string()
    .min(6)
    .max(100)
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 6 caracteres',
      'string.max': 'La contraseña no puede exceder 100 caracteres',
      'any.required': 'La contraseña es requerida'
    })
});

// Schema para registro
const registerSchema = joi.object({
  username: joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.alphanum': 'El username solo puede contener letras y números',
      'string.min': 'El username debe tener al menos 3 caracteres',
      'string.max': 'El username no puede exceder 30 caracteres',
      'any.required': 'El username es requerido'
    }),
    
  email: joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Debe ser un email válido',
      'any.required': 'El email es requerido'
    }),
    
  password: joi.string()
    .min(8)
    .max(100)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.min': 'La contraseña debe tener al menos 8 caracteres',
      'string.max': 'La contraseña no puede exceder 100 caracteres',
      'string.pattern.base': 'La contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial',
      'any.required': 'La contraseña es requerida'
    }),
    
  role: joi.string()
    .valid('user', 'admin', 'moderator')
    .default('user')
    .messages({
      'any.only': 'El rol debe ser: user, admin o moderator'
    })
});

// Schema para cambio de contraseña
const changePasswordSchema = joi.object({
  currentPassword: joi.string()
    .required()
    .messages({
      'any.required': 'La contraseña actual es requerida'
    }),
    
  newPassword: joi.string()
    .min(8)
    .max(100)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])'))
    .required()
    .messages({
      'string.min': 'La nueva contraseña debe tener al menos 8 caracteres',
      'string.max': 'La nueva contraseña no puede exceder 100 caracteres',
      'string.pattern.base': 'La nueva contraseña debe contener al menos: 1 minúscula, 1 mayúscula, 1 número y 1 carácter especial',
      'any.required': 'La nueva contraseña es requerida'
    }),
    
  confirmPassword: joi.string()
    .valid(joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'La confirmación de contraseña debe coincidir',
      'any.required': 'La confirmación de contraseña es requerida'
    })
});

export {
  loginSchema,
  registerSchema,
  changePasswordSchema
};