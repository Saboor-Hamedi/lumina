import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react'
import { PulseLoader } from '../../../components/PulseLoader'

/** Props shared by every format preview component. */
export interface PreviewProps {
  /** Full HTML document produced by the export engine. */
  html: string
  /** True while the preview document is being generated. */
  loading: boolean
  /** Error message when preview generation failed. */
  error?: string | null
  /** Human-readable label shown in empty states, e.g. "PDF". */
  label?: string
  /** Base64-encoded PDF binary (reserved). */
  pdfBase64?: string
  /** Document title. */
  title?: string
  /** Enable zoom controls (defaults to true). */
  allowZoom?: boolean
  /** Initial zoom level. Default 1. */
  initialZoom?: number
}

const ZOOM_STEPS = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.25, 1.4, 1.6, 1.8, 2.0]
const DEFAULT_ZOOM_INDEX = 5 // 1.0

function buildInteractiveSrcDoc(rawHtml: string, initialZoom: number): string {
  if (!rawHtml) return ''

  const helperScript = `
<script>
(function () {
  var currentZoom = ${Number.isFinite(initialZoom) ? initialZoom : 1};
  var pad = 24;

  function ensureStage() {
    if (!document.body) return null;
    var stage = document.getElementById('lumina-zoom-stage');
    if (!stage) {
      stage = document.createElement('div');
      stage.id = 'lumina-zoom-stage';
      var nodes = Array.prototype.slice.call(document.body.childNodes);
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.nodeType === 1 && (n.tagName === 'SCRIPT' || n.tagName === 'STYLE')) continue;
        stage.appendChild(n);
      }
      document.body.insertBefore(stage, document.body.firstChild);
    }
    return stage;
  }

  function applyPreviewZoom(nextZoom) {
    if (typeof nextZoom === 'number' && isFinite(nextZoom) && nextZoom > 0) {
      currentZoom = nextZoom;
    }
    if (!document.body) return;
    ensureStage();

    var hasWebsiteShell = !!document.querySelector('#lumina-zoom-stage > .site-shell');
    var effectivePad = hasWebsiteShell ? 16 : pad;
    var maxStageWidth = hasWebsiteShell ? 1040 : 760;
    var innerWidth = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 720;
    var baseWidth = Math.min(maxStageWidth, Math.max(320, innerWidth - effectivePad * 2));
    var visualWidth = Math.ceil(baseWidth * currentZoom);
    var minBodyWidth = visualWidth + effectivePad * 2;

    var styleEl = document.getElementById('lumina-preview-zoom');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'lumina-preview-zoom';
      (document.head || document.documentElement).appendChild(styleEl);
    }

    styleEl.textContent =
      'html{margin:0!important;padding:0!important;width:100%!important;min-height:100%!important;overflow:auto!important;}' +
      'body{display:block!important;width:max(100%,' + minBodyWidth + 'px)!important;min-height:100vh!important;margin:0!important;padding:' + effectivePad + 'px!important;box-sizing:border-box!important;}' +
      '#lumina-zoom-stage{width:' + visualWidth + 'px!important;margin:0 auto!important;padding:0!important;box-sizing:border-box!important;}' +
      '#lumina-zoom-stage>.page,#lumina-zoom-stage>.doc,#lumina-zoom-stage>.container,#lumina-zoom-stage>.site-shell,#lumina-zoom-stage>pre.md,#lumina-zoom-stage>pre.txt,#lumina-zoom-stage>article{width:' + baseWidth + 'px!important;max-width:none!important;zoom:' + currentZoom + '!important;margin:0!important;box-sizing:border-box!important;}' +
      '#lumina-zoom-stage>.site-shell{border-radius:12px!important;overflow:clip!important;border:1px solid rgba(148,163,184,0.22)!important;box-shadow:0 14px 36px rgba(0,0,0,0.28)!important;}';

    var centerScroll = function () {
      var root = document.documentElement;
      if (!root) return;
      root.scrollLeft = root.scrollWidth > root.clientWidth
        ? Math.round((root.scrollWidth - root.clientWidth) / 2)
        : 0;
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(centerScroll);
    } else {
      setTimeout(centerScroll, 0);
    }
  }

  function blockLinkNav(e) {
    var node = e.target;
    while (node && node.tagName !== 'A') {
      node = node.parentElement;
    }
    if (node && node.tagName === 'A') {
      var href = node.getAttribute('href') || '';
      if (href === '#top') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (href.indexOf('#toc-') === 0) {
        e.preventDefault();
        var targetEl = document.getElementById(href.slice(1));
        if (targetEl && targetEl.scrollIntoView) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }

  window.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'lumina-preview-wheel-zoom', deltaY: e.deltaY }, '*');
    }
  }, { passive: false, capture: true });

  document.addEventListener('click', blockLinkNav, true);
  document.addEventListener('auxclick', blockLinkNav, true);

  window.addEventListener('message', function (e) {
    if (window.parent && e.source && e.source !== window.parent) return;
    if (e.data && e.data.type === 'lumina-preview-set-zoom') {
      applyPreviewZoom(e.data.zoom);
    }
  });

  window.addEventListener('resize', function () {
    applyPreviewZoom(currentZoom);
  });

  function init() {
    applyPreviewZoom(currentZoom);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'lumina-preview-ready' }, '*');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`

  const closeBodyIdx = rawHtml.lastIndexOf('</body>')
  if (closeBodyIdx !== -1) {
    return `${rawHtml.slice(0, closeBodyIdx)}${helperScript}${rawHtml.slice(closeBodyIdx)}`
  }
  return `${rawHtml}${helperScript}`
}

/**
 * PreviewFrame
 *
 * Full-bleed document preview frame with flicker-free zoom via an unzoomed centering
 * stage inside a `sandbox="allow-scripts"` iframe, floating glass zoom pill,
 * and Ctrl+Wheel / touchpad two-finger pinch-to-zoom support.
 */
export const PreviewFrame: React.FC<PreviewProps> = ({
  html,
  loading,
  error,
  label,
  allowZoom = true,
  initialZoom = 1.0
}) => {
  const hasHtml = Boolean(html)
  const initialIndex = useMemo(() => {
    const idx = ZOOM_STEPS.indexOf(initialZoom)
    return idx !== -1 ? idx : DEFAULT_ZOOM_INDEX
  }, [initialZoom])

  const [zoomIndex, setZoomIndex] = useState(initialIndex)
  const zoom = ZOOM_STEPS[zoomIndex]
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const initialZoomRef = useRef(ZOOM_STEPS[initialIndex])

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const pinchAccumRef = useRef(0)
  const lastPinchTimeRef = useRef(0)

  const interactiveSrcDoc = useMemo(() => {
    return buildInteractiveSrcDoc(html, initialZoomRef.current)
  }, [html])

  const postZoomToIframe = useCallback((nextZoom: number) => {
    try {
      const target = iframeRef.current?.contentWindow
      if (target && typeof target.postMessage === 'function') {
        target.postMessage({ type: 'lumina-preview-set-zoom', zoom: nextZoom }, '*')
      }
    } catch {
      /* Ignore iframe messaging errors in minimal environments */
    }
  }, [])

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_STEPS.length - 1))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0))
  }, [])

  const handleResetZoom = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX)
  }, [])

  const applyWheelDelta = useCallback(
    (deltaY: number) => {
      if (!allowZoom || typeof deltaY !== 'number' || !Number.isFinite(deltaY) || deltaY === 0) {
        return
      }

      if (Math.abs(deltaY) >= 40) {
        pinchAccumRef.current = 0
        const zoomIn = deltaY < 0
        setZoomIndex((prev) =>
          zoomIn ? Math.min(prev + 1, ZOOM_STEPS.length - 1) : Math.max(prev - 1, 0)
        )
        return
      }

      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (now - lastPinchTimeRef.current > 240) {
        pinchAccumRef.current = 0
      }
      lastPinchTimeRef.current = now

      if (
        (pinchAccumRef.current > 0 && deltaY < 0) ||
        (pinchAccumRef.current < 0 && deltaY > 0)
      ) {
        pinchAccumRef.current = 0
      }

      pinchAccumRef.current += deltaY
      if (Math.abs(pinchAccumRef.current) >= 12) {
        const zoomIn = pinchAccumRef.current < 0
        pinchAccumRef.current = 0
        setZoomIndex((prev) =>
          zoomIn ? Math.min(prev + 1, ZOOM_STEPS.length - 1) : Math.max(prev - 1, 0)
        )
      }
    },
    [allowZoom]
  )

  useEffect(() => {
    postZoomToIframe(zoom)
  }, [zoom, postZoomToIframe])

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow
      if (e.source && iframeWin && e.source !== iframeWin) return
      const data = e.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'lumina-preview-wheel-zoom') {
        applyWheelDelta(data.deltaY)
      } else if (data.type === 'lumina-preview-ready') {
        postZoomToIframe(zoomRef.current)
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [applyWheelDelta, postZoomToIframe])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      if (!allowZoom || (!e.ctrlKey && !e.metaKey)) return
      e.preventDefault()
      e.stopPropagation()
      applyWheelDelta(e.deltaY)
    }

    el.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => el.removeEventListener('wheel', onWheel, { capture: true })
  }, [allowZoom, applyWheelDelta])

  return (
    <div className="export-preview-wrap">
      <div className="export-preview-viewport" ref={viewportRef}>
        {hasHtml ? (
          <div className="export-preview-scaler">
            <iframe
              ref={iframeRef}
              className="export-preview-frame"
              title={`${label || 'Export'} preview`}
              sandbox="allow-scripts"
              srcDoc={interactiveSrcDoc}
              onLoad={() => postZoomToIframe(zoomRef.current)}
            />
          </div>
        ) : !loading ? (
          <div className="export-preview-empty">
            <AlertTriangle size={20} />
            <p>{error || 'Preview unavailable. You can still export.'}</p>
          </div>
        ) : null}

        {loading && (
          <div className="export-preview-loading" aria-live="polite">
            <PulseLoader message="Generating preview…" delayMs={0} />
          </div>
        )}

        {allowZoom && hasHtml && (
          <div className="preview-floating-zoom" role="toolbar" aria-label="Zoom controls">
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={handleZoomOut}
              disabled={zoomIndex <= 0}
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <button
              type="button"
              className="preview-zoom-chip"
              onClick={handleResetZoom}
              title="Click to reset zoom to 100%"
              aria-label="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              className="preview-zoom-btn"
              onClick={handleZoomIn}
              disabled={zoomIndex >= ZOOM_STEPS.length - 1}
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default PreviewFrame
