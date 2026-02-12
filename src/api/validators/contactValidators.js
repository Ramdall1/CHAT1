import joi from 'joi';

// Schema para crear contacto
const createContactSchema = joi.object({
  phone_number: joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'El número de teléfono debe tener formato internacional válido',
      'any.required': 'El número de teléfono es requerido'
    }),
    
  name: joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.min': 'El nombre debe tener al menos 1 carácter',
      'string.max': 'El nombre no puede exceder 100 caracteres'
    }),
    
  email: joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .messages({
      'string.email': 'Debe ser un email válido'
    }),
    
  tags: joi.array()
    .items(joi.string().max(50))
    .max(20)
    .optional()
    .messages({
      'array.max': 'No se pueden tener más de 20 tags',
      'string.max': 'Cada tag no puede exceder 50 caracteres'
    }),
    
  metadata: joi.object()
    .pattern(joi.string(), joi.alternatives().try(
      joi.string().max(500),
      joi.number(),
      joi.boolean()
    ))
    .optional()
    .messages({
      'string.max': 'Los valores de metadata no pueden exceder 500 caracteres'
    })
});

// Schema para actualizar contacto
const updateContactSchema = joi.object({
  name: joi.string()
    .min(1)
    .max(100)
    .trim()
    .optional()
    .messages({
      'string.min': 'El nombre debe tener al menos 1 carácter',
      'string.max': 'El nombre no puede exceder 100 caracteres'
    }),
    
  email: joi.string()
    .email({ tlds: { allow: false } })
    .optional()
    .allow('')
    .messages({
      'string.email': 'Debe ser un email válido'
    }),
    
  tags: joi.array()
    .items(joi.string().max(50))
    .max(20)
    .optional()
    .messages({
      'array.max': 'No se pueden tener más de 20 tags',
      'string.max': 'Cada tag no puede exceder 50 caracteres'
    }),
    
  metadata: joi.object()
    .pattern(joi.string(), joi.alternatives().try(
      joi.string().max(500),
      joi.number(),
      joi.boolean()
    ))
    .optional()
    .messages({
      'string.max': 'Los valores de metadata no pueden exceder 500 caracteres'
    }),
    
  is_blocked: joi.boolean()
    .optional()
});

// Schema para búsqueda de contactos
const searchContactsSchema = joi.object({
  page: joi.number()
    .integer()
    .min(1)
    .default(1)
    .optional(),
    
  limit: joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50)
    .optional(),
    
  search: joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'El término de búsqueda no puede exceder 100 caracteres'
    }),
    
  tags: joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'El filtro de tags no puede exceder 50 caracteres'
    }),
    
  is_blocked: joi.boolean()
    .optional(),
    
  sort_by: joi.string()
    .valid('name', 'phone_number', 'created_at', 'updated_at')
    .default('created_at')
    .optional(),
    
  sort_order: joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .optional()
});

// Schema para importar contactos en lote
const importContactsSchema = joi.object({
  contacts: joi.array()
    .items(createContactSchema)
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'Debe proporcionar al menos 1 contacto',
      'array.max': 'No se pueden importar más de 1000 contactos a la vez'
    }),
    
  skip_duplicates: joi.boolean()
    .default(true)
    .optional(),
    
  update_existing: joi.boolean()
    .default(false)
    .optional()
});

export {
  createContactSchema,
  updateContactSchema,
  searchContactsSchema,
  importContactsSchema
};