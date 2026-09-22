'use client'

/**
 * This configuration is used to for the Sanity Studio that’s mounted on the `/app/studio/[[...tool]]/page.tsx` route
 */

import {visionTool} from '@sanity/vision'
import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'

// Go to https://www.sanity.io/docs/api-versioning to learn more about API versioning
import {schema} from './sanity/schemaTypes'
import {structure} from './sanity/structure'

const projectId = '8wc8eouj'
const dataset = 'production'
const apiVersion = '2026-09-22'

const isHostedSanityStudio =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('.sanity.studio')

export default defineConfig({
  basePath: isHostedSanityStudio ? '/' : '/studio',
  projectId,
  dataset,
  // Add and edit the content schema in the './sanity/schemaTypes' folder
  schema,
  plugins: [
    structureTool({structure}),
    // Vision is for querying with GROQ from inside the Studio
    // https://www.sanity.io/docs/the-vision-plugin
    visionTool({defaultApiVersion: apiVersion}),
  ],
})
