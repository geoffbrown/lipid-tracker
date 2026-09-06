/* next/link stands in as a plain anchor to the hash route, so the bottom nav
   works in the single-file build exactly as it does under the Next router. */
export default function Link({ href, children, ...rest }) {
  return <a href={`#${href}`} {...rest}>{children}</a>;
}
