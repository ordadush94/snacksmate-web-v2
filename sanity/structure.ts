import {
  BookIcon,
  CheckmarkCircleIcon,
  CloseCircleIcon,
  DocumentsIcon,
  PublishIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

import {RESEARCH_EDITORIAL_DESK} from '../lib/research-editorial/lists'

const RESEARCH_LIST_ICONS = {
  needsReview: WarningOutlineIcon,
  readyToPublish: CheckmarkCircleIcon,
  published: PublishIcon,
  rejected: CloseCircleIcon,
  all: DocumentsIcon,
} as const

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('article').title('Articles'),
      S.listItem()
        .title('Research')
        .icon(BookIcon)
        .child(
          S.list()
            .title('Research')
            .items(
              RESEARCH_EDITORIAL_DESK.map((item) => {
                if (item.kind === 'documentType') {
                  return S.documentTypeListItem(item.schemaType).title(item.title).icon(RESEARCH_LIST_ICONS.all)
                }

                return S.listItem()
                  .title(item.title)
                  .icon(RESEARCH_LIST_ICONS[item.id])
                  .child(
                    S.documentList()
                      .title(item.title)
                      .schemaType('research')
                      .filter(item.filter),
                  )
              }),
            ),
        ),
    ])
