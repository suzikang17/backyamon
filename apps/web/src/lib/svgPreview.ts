// Encode an SVG string into a base64 data URI usable as an <img> src.
// Handles unicode (encodeURIComponent → unescape) before btoa, which only
// accepts latin1.
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
