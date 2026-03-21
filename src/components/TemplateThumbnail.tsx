import { memo } from 'react'

interface TemplateThumbnailProps {
  iconData?: string
  landscape?: boolean
  className?: string
}

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
