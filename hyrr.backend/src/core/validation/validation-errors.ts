import { BadRequestException, ValidationError } from "@nestjs/common"

/**
 * Flattens class-validator errors into `{ "experiences.0.endDate": "End month can't be…" }`
 * (first message per field), so forms can show each error under its own field.
 */
export function fieldErrors(errors: ValidationError[], prefix = ""): Record<string, string> {
  const out: Record<string, string> = {}
  for (const error of errors) {
    const path = prefix ? `${prefix}.${error.property}` : error.property
    const first = Object.values(error.constraints ?? {})[0]
    if (first && !out[path]) out[path] = first
    if (error.children?.length) Object.assign(out, fieldErrors(error.children, path))
  }
  return out
}

/**
 * ValidationPipe exceptionFactory: 400 VALIDATION_FAILED with `details` (the message list, as
 * before) and `fields` (per-field map, consumed by `fieldErrorsOf` in hyrr.shared).
 */
export function validationException(errors: ValidationError[]) {
  const fields = fieldErrors(errors)
  const messages = Object.values(fields)
  return new BadRequestException({
    message: messages.length ? messages : ["Invalid request"],
    errorCode: "VALIDATION_FAILED",
    fields,
  })
}
