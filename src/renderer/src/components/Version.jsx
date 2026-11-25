import { memo, useEffect, useState } from 'react'

function Version() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (window.api?.getVersion) {
      window.api.getVersion().then(setVersion).catch(console.error)
    }
  }, [])

  const cleanVersion = String(version || '2.1.1').replace(/^v/i, '')

  return (
    <span className="select-none font-sans whitespace-nowrap">
      v{cleanVersion}
    </span>
  )
}

export default memo(Version)
