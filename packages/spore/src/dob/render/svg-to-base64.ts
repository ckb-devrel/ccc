export function svgToBase64(svgCode: string) {
  if (typeof window !== 'undefined') {
    return `data:image/svg+xml;base64,${window.btoa(svgCode)}` // browser
  }
  return `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}` // nodejs
}
