/**
 * Scrollable strip of page thumbnails for a notebook.
 * Used in both the list view (horizontal, compact) and editor preview (vertical, full).
 */

import { memo, useMemo } from 'react'
import { TemplateThumbnail } from './TemplateThumbnail'
import type { PageGroup } from '../types/notebook'

interface NotebookPageStripProps {
  pageGroups: PageGroup[]
  orientation?: 'vertical' | 'horizontal'
  /** Max pages to render (for compact list view) */
  maxPages?: number
  className?: string
}

interface ExpandedPage {
  key: string
  groupIndex: number
  pageIndex: number
  iconData?: string
  templateName: string
}

export const NotebookPageStrip = memo(function NotebookPageStrip({
  pageGroups,
  orientation = 'vertical',
  maxPages,
  className,
}: NotebookPageStripProps) {
  const pages = useMemo(() => {
    const expanded: ExpandedPage[] = []
    for (let gi = 0; gi < pageGroups.length; gi++) {
      const group = pageGroups[gi]
      const limit = maxPages !== undefined ? Math.min(group.count, maxPages - expanded.length) : group.count
      for (let pi = 0; pi < limit; pi++) {
        expanded.push({
          key: `${group.id}-${pi}`,
          groupIndex: gi,
          pageIndex: pi,
          iconData: group.iconData,
          templateName: group.templateName,
        })
        if (maxPages !== undefined && expanded.length >= maxPages) break
      }
      if (maxPages !== undefined && expanded.length >= maxPages) break
    }
    return expanded
  }, [pageGroups, maxPages])

  const totalPages = pageGroups.reduce((sum, g) => sum + g.count, 0)
  const truncated = maxPages !== undefined && totalPages > maxPages

  if (pages.length === 0) return null

  const classes = [
    'notebook-page-strip',
    `notebook-page-strip--${orientation}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
      {pages.map((page, idx) => (
        <div key={page.key} className="notebook-page-strip-item">
          <TemplateThumbnail iconData={page.iconData} className="notebook-page-strip-thumb" />
          {orientation === 'vertical' && (
            <span className="notebook-page-strip-label">{idx + 1}</span>
          )}
        </div>
      ))}
      {truncated && (
        <div className="notebook-page-strip-more">
          +{totalPages - pages.length}
        </div>
      )}
    </div>
  )
})
