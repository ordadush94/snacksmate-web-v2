import {BookIcon, CheckmarkCircleIcon, CloseCircleIcon, WarningOutlineIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType, type PreviewValue} from 'sanity'

import {
  editorialPreviewTone,
  EDITORIAL_STATUS_OPTIONS,
  researchPreviewSubtitle,
} from '../../lib/research-editorial/status'

const LANGUAGE_OPTIONS = [
  {title: 'English', value: 'en'},
  {title: 'Hebrew', value: 'he'},
] as const

export const RESEARCH_TOPIC_OPTIONS = [
  {title: 'Exercise Snacks', value: 'exercise-snacks'},
  {title: 'VILPA', value: 'vilpa'},
  {title: 'Cardiorespiratory Fitness', value: 'cardiorespiratory-fitness'},
  {title: 'Glucose', value: 'glucose'},
  {title: 'Cardiometabolic Health', value: 'cardiometabolic-health'},
  {title: 'Sedentary Behavior', value: 'sedentary-behavior'},
  {title: 'Older Adults', value: 'older-adults'},
  {title: 'Workplace Activity', value: 'workplace-activity'},
  {title: 'Physical Activity', value: 'physical-activity'},
  {title: 'Other', value: 'other'},
] as const

export const STUDY_DESIGN_OPTIONS = [
  {title: 'Randomized Controlled Trial', value: 'randomized-controlled-trial'},
  {title: 'Controlled Trial', value: 'controlled-trial'},
  {title: 'Crossover Study', value: 'crossover-study'},
  {title: 'Cohort Study', value: 'cohort-study'},
  {title: 'Cross-sectional Study', value: 'cross-sectional-study'},
  {title: 'Systematic Review', value: 'systematic-review'},
  {title: 'Meta-analysis', value: 'meta-analysis'},
  {title: 'Narrative Review', value: 'narrative-review'},
  {title: 'Scoping Review', value: 'scoping-review'},
  {title: 'Umbrella Review', value: 'umbrella-review'},
  {title: 'Evidence Map', value: 'evidence-map'},
  {title: 'Observational Study', value: 'observational-study'},
  {title: 'Pilot Study', value: 'pilot-study'},
  {title: 'Feasibility Study', value: 'feasibility-study'},
  {title: 'Other', value: 'other'},
] as const

function labelForOption(
  options: readonly {title: string; value: string}[],
  value?: string,
) {
  return options.find((option) => option.value === value)?.title ?? value
}

const linkAnnotation = defineArrayMember({
  name: 'link',
  type: 'object',
  title: 'Link',
  fields: [
    defineField({
      name: 'href',
      title: 'URL',
      type: 'url',
      validation: (rule) =>
        rule.uri({
          allowRelative: true,
          scheme: ['http', 'https', 'mailto', 'tel'],
        }),
    }),
  ],
})

function portableTextOf(options: {
  heading3?: boolean
  numbered?: boolean
  italic?: boolean
}) {
  return [
    defineArrayMember({
      type: 'block',
      styles: [
        {title: 'Normal', value: 'normal'},
        ...(options.heading3 ? [{title: 'H3', value: 'h3'}] : []),
      ],
      lists: [
        {title: 'Bullet', value: 'bullet'},
        ...(options.numbered ? [{title: 'Numbered', value: 'number'}] : []),
      ],
      marks: {
        decorators: [
          {title: 'Bold', value: 'strong'},
          ...(options.italic ? [{title: 'Italic', value: 'em'}] : []),
        ],
        annotations: [linkAnnotation],
      },
    }),
  ]
}

export const researchType = defineType({
  name: 'research',
  title: 'Research',
  type: 'document',
  icon: BookIcon,
  groups: [
    {name: 'basic', title: 'Basic', default: true},
    {name: 'study', title: 'Study details'},
    {name: 'results', title: 'Results'},
    {name: 'interpretation', title: 'Interpretation'},
    {name: 'seo', title: 'SEO'},
    {name: 'editorial', title: 'Editorial Review', icon: CheckmarkCircleIcon},
    {name: 'automation', title: 'Automation'},
  ],
  validation: (rule) =>
    rule
      .custom((document) => {
        const status =
          document && typeof document === 'object' && 'aiEnrichmentStatus' in document
            ? document.aiEnrichmentStatus
            : undefined
        if (status === 'needs_review') {
          return 'AI enrichment needs review. Open Editorial Review and read the enrichment note before publishing.'
        }
        return true
      })
      .warning(),
  fields: [
    defineField({
      name: 'title',
      title: 'Study title',
      type: 'string',
      group: 'basic',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      group: 'basic',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'language',
      title: 'Language',
      type: 'string',
      group: 'basic',
      options: {
        list: [...LANGUAGE_OPTIONS],
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Short summary',
      type: 'text',
      rows: 3,
      group: 'basic',
      description: 'Concise summary for research cards and SEO. Around 160–300 characters.',
      validation: (rule) => [
        rule.required(),
        rule.min(160).warning('Summaries work best at 160 characters or more.'),
        rule.max(300).warning('Summaries work best at 300 characters or fewer.'),
      ],
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
      group: 'basic',
      options: {
        hotspot: true,
      },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          type: 'string',
          description: 'Important for accessibility and SEO.',
        }),
      ],
    }),
    defineField({
      name: 'topic',
      title: 'Research topic',
      type: 'string',
      group: 'basic',
      options: {
        list: [...RESEARCH_TOPIC_OPTIONS],
        layout: 'dropdown',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'summaryAuthor',
      title: 'Research summary author',
      type: 'string',
      group: 'basic',
      description:
        'Author or editor of the Snacksmate research summary, not the original study authors.',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published date',
      type: 'datetime',
      group: 'basic',
      description: 'Date this Snacksmate research summary is published.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated date',
      type: 'datetime',
      group: 'basic',
    }),
    defineField({
      name: 'studyAuthors',
      title: 'Authors',
      type: 'array',
      group: 'study',
      of: [{type: 'string'}],
      description: 'Authors of the scientific study.',
    }),
    defineField({
      name: 'journal',
      title: 'Journal / Source',
      type: 'string',
      group: 'study',
    }),
    defineField({
      name: 'year',
      title: 'Publication year',
      type: 'number',
      group: 'study',
      validation: (rule) => rule.integer().min(1900).max(2100),
    }),
    defineField({
      name: 'studyPublishedAt',
      title: 'Publication date',
      type: 'date',
      group: 'study',
    }),
    defineField({
      name: 'doi',
      title: 'DOI',
      type: 'string',
      group: 'study',
    }),
    defineField({
      name: 'studyUrl',
      title: 'Original study URL',
      type: 'url',
      group: 'study',
      validation: (rule) =>
        rule.uri({
          scheme: ['http', 'https'],
        }),
    }),
    defineField({
      name: 'pmid',
      title: 'PMID',
      type: 'string',
      group: 'study',
      description: 'PubMed ID. Used to avoid importing the same study twice.',
      readOnly: true,
    }),
    defineField({
      name: 'importSource',
      title: 'Import source',
      type: 'string',
      group: 'automation',
      description: 'How this document entered the studio.',
      readOnly: true,
      options: {
        list: [
          {title: 'PubMed', value: 'pubmed'},
          {title: 'Manual', value: 'manual'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
    }),
    defineField({
      name: 'importedAt',
      title: 'Imported at',
      type: 'datetime',
      group: 'automation',
      description: 'When discovery automation created this draft.',
      readOnly: true,
    }),
    defineField({
      name: 'sourceQueries',
      title: 'Source queries',
      type: 'array',
      group: 'automation',
      description: 'Discovery queries that returned this study. Internal provenance only.',
      readOnly: true,
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'automationNote',
      title: 'Automation note',
      type: 'text',
      rows: 4,
      group: 'automation',
      description:
        'Internal editorial note from discovery automation. This is not shown on the public research page.',
    }),
    defineField({
      name: 'studyDesign',
      title: 'Study design',
      type: 'string',
      group: 'study',
      options: {
        list: [...STUDY_DESIGN_OPTIONS],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'population',
      title: 'Population',
      type: 'text',
      rows: 3,
      group: 'study',
      description: 'Example: Physically inactive adults aged 40–65.',
    }),
    defineField({
      name: 'sampleSize',
      title: 'Sample size',
      type: 'number',
      group: 'study',
      validation: (rule) => rule.integer().min(0),
    }),
    defineField({
      name: 'intervention',
      title: 'Intervention',
      type: 'array',
      group: 'study',
      description: 'What participants actually did.',
      of: portableTextOf({italic: false, numbered: false}),
    }),
    defineField({
      name: 'duration',
      title: 'Duration',
      type: 'string',
      group: 'study',
      description: 'Example: 6 weeks',
    }),
    defineField({
      name: 'comparator',
      title: 'Comparator',
      type: 'text',
      rows: 3,
      group: 'study',
    }),
    defineField({
      name: 'outcomes',
      title: 'Outcomes',
      type: 'array',
      group: 'results',
      of: [{type: 'string'}],
      description: 'Examples: VO2peak, postprandial glucose, blood pressure.',
    }),
    defineField({
      name: 'mainFindings',
      title: 'Main findings',
      type: 'array',
      group: 'results',
      of: portableTextOf({heading3: true, numbered: true, italic: true}),
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'practicalInterpretation',
      title: 'Practical interpretation',
      type: 'array',
      group: 'interpretation',
      description:
        "Plain-language interpretation by Snacksmate. This is not a quotation from the original paper.",
      of: portableTextOf({heading3: true, numbered: true, italic: true}),
    }),
    defineField({
      name: 'limitations',
      title: 'Limitations',
      type: 'array',
      group: 'interpretation',
      of: portableTextOf({heading3: true, numbered: true, italic: true}),
    }),
    defineField({
      name: 'snacksmateRelevance',
      title: 'Snacksmate relevance',
      type: 'array',
      group: 'interpretation',
      description: 'Optional explanation of how this research relates to Snacksmate.',
      of: portableTextOf({heading3: true, numbered: true, italic: true}),
    }),
    defineField({
      name: 'references',
      title: 'References',
      type: 'array',
      group: 'interpretation',
      of: [
        defineArrayMember({
          name: 'articleReference',
          title: 'Reference',
          type: 'object',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
            }),
            defineField({
              name: 'source',
              title: 'Source / journal',
              type: 'string',
            }),
            defineField({
              name: 'url',
              title: 'URL',
              type: 'url',
              validation: (rule) =>
                rule.uri({
                  scheme: ['http', 'https'],
                }),
            }),
            defineField({
              name: 'doi',
              title: 'DOI',
              type: 'string',
            }),
            defineField({
              name: 'year',
              title: 'Year',
              type: 'number',
              validation: (rule) => rule.integer().min(1900).max(2100),
            }),
          ],
          preview: {
            select: {
              title: 'title',
              source: 'source',
              year: 'year',
            },
            prepare({title, source, year}) {
              return {
                title: title || 'Untitled reference',
                subtitle: [source, year].filter(Boolean).join(' · '),
              }
            },
          },
        }),
      ],
    }),
    defineField({
      name: 'seoTitle',
      title: 'SEO title',
      type: 'string',
      group: 'seo',
      description: 'Optional override for search results. Recommended maximum is around 60 characters.',
      validation: (rule) =>
        rule.max(60).warning('SEO titles work best at 60 characters or fewer.'),
    }),
    defineField({
      name: 'seoDescription',
      title: 'SEO description',
      type: 'text',
      rows: 3,
      group: 'seo',
      description: 'Optional override for search results. Recommended maximum is around 160 characters.',
      validation: (rule) =>
        rule
          .max(160)
          .warning('SEO descriptions work best at 160 characters or fewer.'),
    }),
    defineField({
      name: 'canonicalUrl',
      title: 'Canonical URL',
      type: 'url',
      group: 'seo',
      validation: (rule) =>
        rule.uri({
          scheme: ['http', 'https'],
        }),
    }),
    defineField({
      name: 'translationSlug',
      title: 'Translation slug',
      type: 'string',
      group: 'seo',
      description:
        'Associates the Hebrew and English versions of the same research summary. Use the matching document slug or a shared key.',
    }),
    defineField({
      name: 'editorialStatus',
      title: 'Editorial status',
      type: 'string',
      group: 'editorial',
      options: {
        list: EDITORIAL_STATUS_OPTIONS.map((option) => ({...option})),
        layout: 'radio',
      },
      description:
        'Internal review state. Empty drafts are treated as Needs review. AI enrichment sets Needs review only when this is empty and never overwrites a status you have saved. Choosing Ready to publish does not publish the document. This is not shown on the public research page.',
    }),
    defineField({
      name: 'editorialReviewNote',
      title: 'Editorial review note',
      type: 'text',
      rows: 4,
      group: 'editorial',
      description:
        'Internal note for the editor. Examples: verify sample size, simplify practical interpretation, check DOI, confirm intervention frequency, reject as commentary. This is not shown on the public research page.',
    }),
    defineField({
      name: 'editorialChecklist',
      title: 'Review checklist',
      type: 'object',
      group: 'editorial',
      description:
        'Optional. None of these are required before a manual publish. Internal only. This is not shown on the public research page.',
      options: {
        collapsible: true,
        collapsed: false,
      },
      fields: [
        defineField({
          name: 'reviewedMetadata',
          title: 'Metadata reviewed',
          type: 'boolean',
          description: 'Title, language, topic, year, DOI, and study URL.',
        }),
        defineField({
          name: 'reviewedScientificSummary',
          title: 'Scientific summary reviewed',
          type: 'boolean',
          description: 'Excerpt, study design, population, and main findings.',
        }),
        defineField({
          name: 'reviewedPracticalInterpretation',
          title: 'Practical interpretation reviewed',
          type: 'boolean',
        }),
        defineField({
          name: 'reviewedLinks',
          title: 'Links reviewed',
          type: 'boolean',
          description: 'DOI, original study URL, and references.',
        }),
      ],
    }),
    defineField({
      name: 'reviewedAt',
      title: 'Reviewed at',
      type: 'datetime',
      group: 'editorial',
      description:
        'Optional. When an editor reviewed this draft. Internal only. This is not shown on the public research page.',
    }),
    defineField({
      name: 'reviewedBy',
      title: 'Reviewed by',
      type: 'string',
      group: 'editorial',
      description:
        'Optional. Name of the editor. Internal only. This is not shown on the public research page.',
    }),
    defineField({
      name: 'aiEnrichedAt',
      title: 'AI enriched at',
      type: 'datetime',
      group: 'editorial',
      readOnly: true,
      description:
        'When enrichment last finished. Internal only. This is not shown on the public research page.',
    }),
    defineField({
      name: 'aiModel',
      title: 'AI model',
      type: 'string',
      group: 'editorial',
      readOnly: true,
      description:
        'Model id that produced the latest enrichment. Internal only. This is not shown on the public research page.',
    }),
    defineField({
      name: 'aiEnrichmentStatus',
      title: 'AI enrichment status',
      type: 'string',
      group: 'editorial',
      options: {
        list: [
          {title: 'Pending', value: 'pending'},
          {title: 'Completed', value: 'completed'},
          {title: 'Failed', value: 'failed'},
          {title: 'Needs review', value: 'needs_review'},
        ],
        layout: 'radio',
      },
      description:
        'Internal enrichment state. This is not shown on the public research page. Completed and Needs review drafts are skipped. Set this back to Pending to allow another run. A failed model call does not change this field. This does not change editorial status once an editor has saved one, and it never publishes.',
      validation: (rule) =>
        rule
          .custom((value) => {
            if (value === 'needs_review') {
              return 'AI flagged this draft for human review. Read the enrichment note before publishing.'
            }
            return true
          })
          .warning(),
    }),
    defineField({
      name: 'aiEnrichmentNote',
      title: 'AI enrichment note',
      type: 'text',
      rows: 4,
      group: 'editorial',
      description:
        'Internal editorial note from enrichment. This is not shown on the public research page.',
    }),
  ],
  orderings: [
    {
      title: 'Published date, newest',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
    {
      title: 'Study year, newest',
      name: 'yearDesc',
      by: [{field: 'year', direction: 'desc'}],
    },
  ],
  preview: {
    select: {
      title: 'title',
      id: '_id',
      language: 'language',
      topic: 'topic',
      studyDesign: 'studyDesign',
      year: 'year',
      editorialStatus: 'editorialStatus',
      aiEnrichmentStatus: 'aiEnrichmentStatus',
      media: 'mainImage',
    },
    prepare({
      title,
      id,
      language,
      topic,
      studyDesign,
      year,
      editorialStatus,
      aiEnrichmentStatus,
      media,
    }) {
      return {
        title: title || 'Untitled research',
        subtitle: researchPreviewSubtitle({
          editorialStatus,
          aiEnrichmentStatus,
          documentId: id,
          details: [
            labelForOption(LANGUAGE_OPTIONS, language),
            labelForOption(RESEARCH_TOPIC_OPTIONS, topic),
            labelForOption(STUDY_DESIGN_OPTIONS, studyDesign),
            year,
          ],
        }),
        media: editorialPreviewMedia(editorialStatus, media, id),
      }
    },
  },
})

function editorialPreviewMedia(
  status: string | undefined,
  image: PreviewValue['media'],
  documentId?: string,
): PreviewValue['media'] {
  const tone = editorialPreviewTone(status, documentId)
  if (tone === 'needs_review') return WarningOutlineIcon
  if (tone === 'ready_to_publish') return CheckmarkCircleIcon
  if (tone === 'rejected') return CloseCircleIcon
  return image
}
