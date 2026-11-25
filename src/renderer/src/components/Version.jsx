import { memo, useEffect, useState } from 'react'

function Version() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setVersion).catch(console.error)
    }
  }, [])

  if (!version) return null

  const cleanVersion = String(version).replace(/^v/i, '')

  return (
    <span className="select-none font-sans whitespace-nowrap">
      v{cleanVersion}
    </span>
  )
}

export default memo(Version)
