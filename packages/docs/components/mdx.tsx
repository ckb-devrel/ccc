import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import { Mermaid } from '@/components/mermaid';
import { Cite } from '@/components/cite';
import { ExampleGrid } from '@/components/example-grid';
import type { MDXComponents } from 'mdx/types';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Step,
    Steps,
    Tab,
    Tabs,
    Mermaid,
    // Source-code citation chip. NOTE: MDX 3 treats lowercase `<cite>` as
    // raw HTML (not JSX), so it cannot be intercepted via the components
    // map. Always write `<Cite ... />` (capitalized) in MDX content.
    Cite,
    ExampleGrid,
    pre: ({ ref: _ref, ...props }) => (
      <CodeBlock {...props}>
        <Pre>{props.children}</Pre>
      </CodeBlock>
    ),
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
