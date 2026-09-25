import {type SchemaTypeDefinition} from 'sanity'

import {articleType} from './article'
import {researchType} from './research'

export const schema: {types: SchemaTypeDefinition[]} = {
  types: [articleType, researchType],
}
