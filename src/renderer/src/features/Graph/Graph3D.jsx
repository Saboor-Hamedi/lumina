import React, { useEffect, useRef, useImperativeHandle } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { useSettingsStore } from '../../core/store/useSettingsStore'
import { forceX, forceY } from 'd3-force'
import { forceCollide } from 'd3-force-3d'

const Graph3D = React.forwardRef(({
  graphData,
  ...restProps
}, ref) => {
  const internalRef = useRef()

  useImperativeHandle(ref, () => internalRef.current)

  const reheatTimeoutRef = useRef(null)

  // Physics Engine Setup
  useEffect(() => {
    const unsubscribe = useSettingsStore.subscribe(
      (state, prevState) => {
        const { settings } = state
        const prev = prevState.settings
        
        if (
          settings.graphNodeSize !== prev.graphNodeSize ||
          settings.graphCenterForce !== prev.graphCenterForce ||
          settings.graphRepelForce !== prev.graphRepelForce ||
          settings.graphLinkForce !== prev.graphLinkForce
        ) {
          if (!internalRef.current) return
          const fg = internalRef.current

          setTimeout(() => {
            const centerForce = settings.graphCenterForce ?? 0.05
            const repelForce = settings.graphRepelForce ?? 0.3
            const linkForce = settings.graphLinkForce ?? 0.05

            fg.d3Force('custom_x').strength(0)
            fg.d3Force('custom_y').strength(0)
            
            fg.d3Force('custom_gravity', (alpha) => {
              // Increase multiplier to pull the clusters tighter
              const strength = centerForce * 0.3
              const maxRadius = 1000
              const orphanPull = 0.5
              
              graphData.nodes.forEach(n => {
                if (n.val <= 1) {
                  const dist = Math.hypot(n.x || 0, n.y || 0, n.z || 0) || 1
                  if (dist > maxRadius) {
                    const force = (dist - maxRadius) * orphanPull * alpha / dist
                    n.vx -= (n.x || 0) * force
                    n.vy -= (n.y || 0) * force
                    n.vz -= (n.z || 0) * force
                  }
                } else {
                  n.vx -= (n.x || 0) * strength * alpha
                  n.vy -= (n.y || 0) * strength * alpha
                  n.vz -= (n.z || 0) * strength * alpha
                }
              })
            })
            if (fg.d3Force('custom_radial')) fg.d3Force('custom_radial', null)
            if (fg.d3Force('custom_charge')) fg.d3Force('custom_charge', null)
            
            // Apply 3D collision so nodes don't tangle, using dynamic radius based on node volume
            fg.d3Force('custom_collide', forceCollide().radius((n) => {
              const base = n.val ? Math.max(2, Math.sqrt(n.val) * 2.5) : 2
              const sizeMult = settings.graphNodeSize || 1.5
              return (base * sizeMult) + 2
            }).strength(0.8).iterations(1))
            
            if (fg.d3Force('charge')) fg.d3Force('charge').strength(-500 * repelForce)
            if (fg.d3Force('link')) fg.d3Force('link').strength(linkForce)

            if (reheatTimeoutRef.current) clearTimeout(reheatTimeoutRef.current)
            reheatTimeoutRef.current = setTimeout(() => {
              if (internalRef.current) internalRef.current.d3ReheatSimulation()
            }, 300)
          }, 50)
        }
      }
    )

    if (!internalRef.current) return
    const fg = internalRef.current
    
    const initTimer = setTimeout(() => {
      const initialSettings = useSettingsStore.getState().settings

      const centerForce = initialSettings.graphCenterForce ?? 0.05
      const repelForce = initialSettings.graphRepelForce ?? 0.3
      const linkForce = initialSettings.graphLinkForce ?? 0.05

      if (!fg.d3Force('custom_x')) fg.d3Force('custom_x', forceX(0))
      if (!fg.d3Force('custom_y')) fg.d3Force('custom_y', forceY(0))

      fg.d3Force('custom_radial', null)
      fg.d3Force('custom_charge', null)
      fg.d3Force('custom_collide', null)
      
      fg.d3Force('custom_gravity', (alpha) => {
        // Increase multiplier to pull the clusters tighter
        const strength = centerForce * 0.3
        const maxRadius = 1000
        const orphanPull = 0.5
        
        graphData.nodes.forEach(n => {
          if (n.val <= 1) {
            const dist = Math.hypot(n.x || 0, n.y || 0, n.z || 0) || 1
            if (dist > maxRadius) {
              const force = (dist - maxRadius) * orphanPull * alpha / dist
              n.vx -= (n.x || 0) * force
              n.vy -= (n.y || 0) * force
              n.vz -= (n.z || 0) * force
            }
          } else {
            n.vx -= (n.x || 0) * strength * alpha
            n.vy -= (n.y || 0) * strength * alpha
            n.vz -= (n.z || 0) * strength * alpha
          }
        })
      })

      if (fg.cameraPosition) {
        setTimeout(() => fg.cameraPosition({ z: 2000 }, { x: 0, y: 0, z: 0 }, 0), 100)
      }
      if (fg.controls) {
        const controls = fg.controls()
        if (controls) controls.enableDamping = false
      }

      fg.d3Force('x', null)
      fg.d3Force('y', null)
      fg.d3Force('z', null)
      fg.d3Force('radial', null)
      fg.d3Force('center', null)
      
      fg.d3Force('custom_x').strength(0)
      fg.d3Force('custom_y').strength(0)
      
      fg.d3Force('custom_collide', forceCollide().radius((n) => {
        const base = n.val ? Math.max(2, Math.sqrt(n.val) * 2.5) : 2
        const sizeMult = initialSettings.graphNodeSize || 1.5
        return (base * sizeMult) + 2
      }).strength(0.8).iterations(1))
      
      if (fg.d3Force('charge')) {
        fg.d3Force('charge').strength(-500 * repelForce)
      }

      if (fg.d3Force('link')) fg.d3Force('link').distance(150).strength(linkForce)

      setTimeout(() => {
        if (internalRef.current) internalRef.current.d3ReheatSimulation()
      }, 150)
    }, 150)

    return () => {
      unsubscribe()
      clearTimeout(initTimer)
      if (reheatTimeoutRef.current) clearTimeout(reheatTimeoutRef.current)
    }
  }, [graphData])

  return (
    <ForceGraph3D
      ref={internalRef}
      graphData={graphData}
      {...restProps}
    />
  )
})

Graph3D.displayName = 'Graph3D'

export default React.memo(Graph3D)
