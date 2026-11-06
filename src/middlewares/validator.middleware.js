import { z } from 'zod';

/**
 * Higher-order middleware to validate req.body against a Zod schema.
 * @param {z.ZodSchema} schema
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const formattedErrors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        errors: formattedErrors,
      });
    }

    req.validatedBody = result.data;
    next();
  };
}

// Schema for single email verification (POST /v1/verify)
export const singleEmailSchema = z.object({
  email: z
    .string({
      required_error: 'email is required in JSON body',
      invalid_type_error: 'email must be a string',
    })
    .trim()
    .min(1, 'email cannot be empty'),
});

// Schema for batch email verification (POST /v1/verify/batch)
export const batchEmailSchema = z.object({
  emails: z
    .array(
      z
        .string({ invalid_type_error: 'Each email in the array must be a string' })
        .trim()
        .min(1, 'Email item cannot be empty'),
      {
        required_error: 'emails array is required in JSON body',
        invalid_type_error: 'emails must be an array of strings',
      }
    )
    .min(1, 'Batch must contain at least 1 email')
    .max(50, 'Batch limit exceeded: maximum 50 emails allowed per request'),
});
