/** A known fallback secret is never safe outside local development. */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return 'hyrr_local_development_secret_change_me';
}
