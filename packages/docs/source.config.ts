import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { z } from 'zod';

// Main docs collection — modules like Getting Started, Concepts, Guides, Wallets
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // Require a non-empty `description` so the auto-generated llms.txt index
    // always carries a one-line summary for every page (AI consumption).
    schema: pageSchema.extend({
      description: z.string().min(1),
    }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

// Blog posts — use defineDocs so the loader's `toFumadocsSource()` works
export const blog = defineDocs({
  dir: 'content/blog',
  docs: {
    schema: pageSchema.extend({
      author: z.string(),
      date: z.string().date().or(z.date()),
      tags: z.array(z.string()).optional(),
    }),
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options
    remarkPlugins: [remarkMdxMermaid],
  },
});
