export const uuidSchema = { type: 'string', pattern: '^[0-9a-fA-F-]{36}$' } as const
export const errorResponseSchema = {
  type: 'object', additionalProperties: false, required: ['error'],
  properties: { error: { type: 'object', additionalProperties: false, required: ['code', 'message', 'requestId'], properties: { code: { type: 'string' }, message: { type: 'string' }, requestId: { type: 'string' } } } },
} as const

export const dashboardNameBody = { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 } } } as const
export const widgetBody = { type: 'object', additionalProperties: false, required: ['widgetType'], properties: { widgetType: { type: 'string', minLength: 1, maxLength: 80 }, configuration: { type: 'object', maxProperties: 50 }, layout: { type: 'object', maxProperties: 20 }, isEnabled: { type: 'boolean' } } } as const
export const bookmarkBody = { type: 'object', additionalProperties: false, required: ['name', 'url'], properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, url: { type: 'string', format: 'uri', maxLength: 2048 }, icon: { type: 'string', maxLength: 120 }, category: { type: 'string', maxLength: 120 }, sortOrder: { type: 'integer', minimum: 0, maximum: 100000 } } } as const
