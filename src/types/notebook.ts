/** Types for the multipage notebook builder */

/** A single page in an expanded notebook */
export interface NotebookPage {
  /** UUID for this page */
  id: string
  /** Template reference: classic name string or "uuid:orientation" for methods */
  templateRef: string
  /** Display name for UI */
  templateName: string
}

/** A group of pages sharing the same template */
export interface PageGroup {
  /** UUID for this group */
  id: string
  /** Template reference: classic name string or "uuid:orientation" for methods */
  templateRef: string
  /** Display name for UI */
  templateName: string
  /** Number of pages with this template */
  count: number
  /** Base64-encoded SVG thumbnail */
  iconData?: string
}

/** Complete notebook definition for export/deploy */
export interface NotebookDefinition {
  name: string
  pageGroups: PageGroup[]
  orientation?: 'portrait' | 'landscape'
  deviceId: string
  /** If set, reuse this UUID on device instead of generating a new one (update-in-place) */
  reuseUuid?: string
}

/** CRDT timestamp in "replicaId:sequenceNumber" format */
export interface CrdtValue<T> {
  timestamp: string
  value: T
}

/** A page entry in the cPages v2 format */
export interface CPage {
  id: string
  idx: CrdtValue<string>
  template: CrdtValue<string>
}

/** The cPages v2 structure */
export interface CPages {
  lastOpened: CrdtValue<string>
  original: CrdtValue<number>
  pages: CPage[]
  uuids: Array<{ first: string; second: number }>
}

/** Complete .content file structure */
export interface NotebookContent {
  cPages: CPages
  coverPageNumber: number
  customZoomCenterX: number
  customZoomCenterY: number
  customZoomOrientation: string
  customZoomPageHeight: number
  customZoomPageWidth: number
  customZoomScale: number
  documentMetadata: Record<string, unknown>
  extraMetadata: Record<string, string>
  fileType: 'notebook'
  fontName: string
  formatVersion: 2
  lineHeight: number
  orientation: string
  pageCount: number
  pageTags: unknown[]
  sizeInBytes: string
  tags: unknown[]
  textAlignment: string
  textScale: number
  zoomMode: string
}

/** Complete .metadata file structure */
export interface NotebookMetadata {
  createdTime: string
  deleted: boolean
  lastModified: string
  lastOpened: string
  lastOpenedPage: number
  metadatamodified: boolean
  modified: boolean
  new: boolean
  parent: string
  pinned: boolean
  source: string
  synced: boolean
  type: 'DocumentType'
  version: number
  visibleName: string
}

/** .local file structure */
export interface NotebookLocal {
  contentFormatVersion: 2
}
