import { memo } from 'react'

interface TemplateThumbnailProps {
  /** Base64-encoded SVG icon data (from the registry's `iconCode` field). */
  iconData?: string
  /** If true, applies landscape aspect ratio styling. */
  landscape?: boolean
  className?: string
}

/**
 * Memoized inline thumbnail that renders a base64-encoded SVG template icon.
 * Used in sidebar list items, notebook page strips, and template picker grids.
 * Returns null if no iconData is provided.
 */
export const TemplateThumbnail = memo(function TemplateThumbnail({ iconData, landscape, className }: TemplateThumbnailProps) {
  if (!iconData) return null

  const orientClass = landscape ? 'landscape' : 'portrait'
  const classes = ['template-thumbnail', orientClass, className].filter(Boolean).join(' ')

  return (
    <img
      className={classes}
      src={`data:image/svg+xml;base64,${iconData}`}
      alt=""
    />
  )
})
