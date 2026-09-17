/**
 * Prefix a public asset path with the configured basePath.
 *
 * Only needed for bare `<img src="/…" />` tags or inline CSS `url('/…')`.
 * `<Link>` and `next/image` already auto-prefix basePath.
 */
export function assetUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  return `${base}${path}`;
}
