// Show the media file name inside ComfyUI's full-screen media lightbox,
// together with a download button for that file.
//
// Why this exists: the lightbox (frontend src/components/sidebar/tabs/queue/
// MediaLightbox.vue, used by the Assets / Job History / Queue sidebars) renders
// its image through ComfyImage with `alt = <file name>` and
// `src = resultItemUrl(item)`, but never renders that text and offers no
// download control. There is no setting for either in 1.55.x or upstream
// 1.57.x. The DOM root is `<div role="dialog" data-mask ...>` teleported to
// <body>, so the img's alt (name) and src (the original /view URL) are the only
// handles — this module mirrors both into a caption overlay: the name text plus
// a download button that saves the file under that same name.
//
// Pure DOM. No core patch, no frontend fork, removable by deleting the folder.

const LIGHTBOX_SELECTOR = '[data-mask][role="dialog"]'
const CAPTION_CLASS = 'comfy-asset-filename-caption'
const NAME_CLASS = 'comfy-asset-filename-caption-name'
const DOWNLOAD_CLASS = 'comfy-asset-filename-download'
const STYLE_ID = 'comfy-asset-filename-caption-style'
// ComfyImage's default alt, used when no name is supplied.
const DEFAULT_ALT = 'Image content'

// lucide "download", inlined so the overlay needs no icon-font dependency.
const DOWNLOAD_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`

const CAPTION_CSS = `
.${CAPTION_CLASS} {
  position: absolute;
  bottom: 1.25rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  max-width: min(90vw, 60rem);
  padding: 0.3rem 0.5rem 0.3rem 0.75rem;
  border-radius: 0.375rem;
  background: rgba(0, 0, 0, 0.72);
  color: #ffffff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  z-index: 1;
  pointer-events: none;
}
.${CAPTION_CLASS} > .${NAME_CLASS} {
  min-width: 0;
  word-break: break-all;
  text-align: center;
}
.${CAPTION_CLASS} > .${DOWNLOAD_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.25rem;
  color: inherit;
  background: rgba(255, 255, 255, 0.12);
  text-decoration: none;
  pointer-events: auto;
  cursor: pointer;
}
.${CAPTION_CLASS} > .${DOWNLOAD_CLASS}:hover {
  background: rgba(255, 255, 255, 0.26);
}
.${CAPTION_CLASS} > .${DOWNLOAD_CLASS}:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 1px;
}
.${CAPTION_CLASS} > .${DOWNLOAD_CLASS} > svg {
  width: 0.875rem;
  height: 0.875rem;
  display: block;
}
`

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CAPTION_CSS
  document.head.appendChild(style)
}

// A bare file name: the lightbox alt is already one, but a stray path
// separator would break the `download` attribute.
function baseName(value) {
  return (value || '').split(/[\\/]/).pop() || ''
}

function fileNameIn(root) {
  const img = root.querySelector('img[alt]')
  const name = img?.getAttribute('alt')?.trim()
  if (!name || name === DEFAULT_ALT) return ''
  return baseName(name)
}

// The lightbox image src is `api.apiURL('/view?' + {filename, type, subfolder})`
// — the original stored file, not a `preview=` transcode — and it is
// same-origin, so the `download` attribute is honoured and the browser saves
// the real bytes. A cross-origin src would ignore it (not the case locally).
function downloadUrlIn(root) {
  const img = root.querySelector('img[alt]')
  return img?.currentSrc || img?.getAttribute('src') || ''
}

function buildCaption(root, name, href) {
  const caption = document.createElement('div')
  caption.className = CAPTION_CLASS

  const label = document.createElement('span')
  // The image alt already conveys the name to assistive tech; the interactive
  // download link must stay outside any aria-hidden subtree.
  label.className = NAME_CLASS
  label.setAttribute('aria-hidden', 'true')
  label.textContent = name
  caption.appendChild(label)

  if (href) {
    const link = document.createElement('a')
    link.className = DOWNLOAD_CLASS
    link.href = href
    link.setAttribute('download', name)
    link.setAttribute('aria-label', `Download ${name}`)
    link.title = `Download ${name}`
    link.innerHTML = DOWNLOAD_ICON
    // The dialog closes on mask mousedown/mouseup and handles arrow keys;
    // keep the button's own events out of those handlers.
    for (const type of ['mousedown', 'mouseup', 'click']) {
      link.addEventListener(type, (event) => event.stopPropagation())
    }
    caption.appendChild(link)
  }

  root.appendChild(caption)
  return caption
}

function syncRoot(root) {
  const name = fileNameIn(root)

  if (!name) {
    root.querySelector(`:scope > .${CAPTION_CLASS}`)?.remove()
    return
  }

  const img = root.querySelector('img[alt]')
  if (img && img.title !== name) img.title = name

  const href = downloadUrlIn(root)
  let caption = root.querySelector(`:scope > .${CAPTION_CLASS}`)

  if (!caption) {
    buildCaption(root, name, href)
    return
  }

  const label = caption.querySelector(`:scope > .${NAME_CLASS}`)
  if (label && label.textContent !== name) label.textContent = name

  const link = caption.querySelector(`:scope > .${DOWNLOAD_CLASS}`)
  if (!href) {
    link?.remove()
    return
  }
  if (!link) {
    // Structure was built while the src was still resolving: rebuild the link.
    caption.replaceWith(buildCaption(root, name, href))
    return
  }
  if (link.getAttribute('href') !== href) link.href = href
  if (link.getAttribute('download') !== name) link.setAttribute('download', name)
  const title = `Download ${name}`
  if (link.title !== title) {
    link.title = title
    link.setAttribute('aria-label', title)
  }
}

let scheduled = false

function scheduleSync() {
  if (scheduled) return
  scheduled = true
  // setTimeout, not requestAnimationFrame: rAF callbacks do not run while the
  // document is hidden (background tab, minimised window), which would leave
  // the overlay absent and `scheduled` latched. Every write in syncRoot is
  // change-guarded, so the observer settles after one extra pass.
  setTimeout(() => {
    scheduled = false
    for (const root of document.querySelectorAll(LIGHTBOX_SELECTOR)) {
      syncRoot(root)
    }
  }, 0)
}

function start() {
  if (typeof document === 'undefined' || !document.body) return

  ensureStyle()

  // Arrow-key navigation swaps the <img> (keyed on the asset URL), so a
  // childList observer on the subtree catches open / next / prev / close; the
  // attribute filter also catches an in-place src/alt change. Every write made
  // here is change-guarded, so the observer settles after one extra pass; the
  // setTimeout coalescing in scheduleSync keeps this cheap on a busy page.
  new MutationObserver(scheduleSync).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'alt']
  })

  scheduleSync()
}

start()
