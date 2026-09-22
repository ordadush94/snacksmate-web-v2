/**
* This configuration file lets you run `$ sanity [command]` in this folder
* Go to https://www.sanity.io/docs/cli to learn more.
**/
import { defineCliConfig } from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '8wc8eouj',
    dataset: 'production',
  },
  studioHost: 'snacksmate',
  deployment: {
    appId: 'ptpammm4gmsm9u7eiy7b20mc',
  },
})
