/** http(s) and the webview's own URIs only — no `data:` images. */
export function imgSrcCsp(cspSource: string): string {
  return `img-src ${cspSource} https: http:`;
}
