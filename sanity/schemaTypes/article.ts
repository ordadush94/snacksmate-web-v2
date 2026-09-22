import {DocumentTextIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

const LANGUAGE_OPTIONS = [
  {title: 'Hebrew', value: 'he'},
  {title: 'English', value: 'en'},
] as const

const TOPIC_OPTIONS = [
  {title: 'Exercise Snacks', value: 'exercise-snacks'},
  {title: 'Research', value: 'research'},
  {title: 'Fitness', value: 'fitness'},
  {title: 'Health', value: 'health'},
  {title: 'VILPA', value: 'vilpa'},
  {title: 'Snacksmate', value: 'snacksmate'},
] as const

function labelForOption(
  options: readonly {title: string; value: string}[],
  value?: string,
) {
  return options.find((option) => option.value === value)?.title ?? value
}

export const articleType = defineType({
  name: 'article',
  title: 'Article',
  type: 'document',
  icon: DocumentTextIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
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
      options: {
        list: [...LANGUAGE_OPTIONS],
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'excerpt',
      title: 'Short description',
      type: 'text',
      rows: 3,
      description: 'Short summary of the article, around 160–300 characters.',
      validation: (rule) =>
        rule
          .required()
          .min(160)
          .max(300)
          .error('Excerpt should be between 160 and 300 characters.'),
    }),
    defineField({
      name: 'mainImage',
      title: 'Main image',
      type: 'image',
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
      name: 'body',
      title: 'Article body',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'H2', value: 'h2'},
            {title: 'H3', value: 'h3'},
          ],
          lists: [
            {title: 'Bullet', value: 'bullet'},
            {title: 'Numbered', value: 'number'},
          ],
          marks: {
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
            ],
            annotations: [
              defineArrayMember({
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
              }),
            ],
          },
        }),
      ],
    }),
    defineField({
      name: 'topic',
      title: 'Topic',
      type: 'string',
      options: {
        list: [...TOPIC_OPTIONS],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'author',
      title: 'Author',
      type: 'string',
      description: 'Simple author name for now. This is not a separate document type yet.',
    }),
    defineField({
      name: 'publishedAt',
      title: 'Published date',
      type: 'datetime',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Updated date',
      type: 'datetime',
    }),
    defineField({
      name: 'references',
      title: 'References',
      type: 'array',
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
      description: 'Optional override for search results. Recommended maximum is around 60 characters.',
      validation: (rule) =>
        rule.max(60).warning('SEO titles work best at 60 characters or fewer.'),
    }),
    defineField({
      name: 'seoDescription',
      title: 'SEO description',
      type: 'text',
      rows: 3,
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
      validation: (rule) =>
        rule.uri({
          scheme: ['http', 'https'],
        }),
    }),
    defineField({
      name: 'translationSlug',
      title: 'Translation slug',
      type: 'string',
      description:
        'Used later to associate Hebrew and English versions of the same article.',
    }),
  ],
  preview: {
    select: {
      title: 'title',
      language: 'language',
      topic: 'topic',
      publishedAt: 'publishedAt',
      media: 'mainImage',
    },
    prepare({title, language, topic, publishedAt, media}) {
      const languageLabel = labelForOption(LANGUAGE_OPTIONS, language)
      const topicLabel = labelForOption(TOPIC_OPTIONS, topic)
      const publishedLabel = publishedAt
        ? new Date(publishedAt).toLocaleDateString()
        : undefined

      return {
        title: title || 'Untitled article',
        subtitle: [languageLabel, topicLabel, publishedLabel]
          .filter(Boolean)
          .join(' · '),
        media,
      }
    },
  },
})
