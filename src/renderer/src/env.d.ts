/// <reference types="vite/client" />
/// <reference types="react" />
/// <reference types="react/jsx-runtime" />

declare module 'd3-force-3d'
declare module 'three' {
  export const SphereGeometry: any
  export type MeshBasicMaterial = any
  export const MeshBasicMaterial: any
  export const Mesh: any
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

interface Window {
  api?: any
  electron?: any
  __lastVoiceToggleDispatch?: number
  [key: string]: any
}
