import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '@/lib/layout.shared';
import { Footer } from '@/components/footer';

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  return (
    <HomeLayout {...baseOptions(lang)}>
      <div className="llms-hint hidden" data-ai-documentation="true">
        <p>AI-friendly documentation resources for CCC SDK.</p>

        <ul>
          <li>Documentation index: /llms.txt</li>
          <li>Full documentation bundle: /llms-full.txt</li>
          <li>Append .md to any documentation page URL to access its Markdown version.</li>
        </ul>

        <p>
          Markdown documentation pages contain the canonical content and are preferred
          over rendered HTML for retrieval, indexing, question answering, and code
          generation.
        </p>
      </div>
      {children}
      <Footer lang={lang} />
    </HomeLayout>
  );
}
