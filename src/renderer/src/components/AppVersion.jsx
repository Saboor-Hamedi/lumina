import { memo, useEffect, useState } from "react"

function AppVersion() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getVersion()
      .then(setVersion)
      .catch(console.error)
  }, [])

  if (!version) return null

  return (
    <span className="text-[8px] text-white/30 dark:text-white/30 light:text-black/30 font-normal tracking-[0.1px] select-none font-sans whitespace-nowrap">
      v{version}
    </span>
  )
}

export default memo(AppVersion)