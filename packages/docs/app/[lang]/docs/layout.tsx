import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/notebook';
import { baseOptions } from '@/lib/layout.shared';

export default async function Layout({
  params,
  children,
}: LayoutProps<'/[lang]/docs'>) {
  const { lang } = await params;
  
  return (
    <DocsLayout 
      tree={source.getPageTree(lang)}
      tabMode="navbar"
      sidebar={{
        tabs: {
          transform(option, node) {
            const meta = source.getNodeMeta(node);
            if (!meta) return option;

            return {
              ...option,
              icon: (  
                <div className="[&_svg]:size-4">  
                  {node.icon}  
                </div>  
              ),  
            };
          },
        },
      }}
      {...baseOptions(lang, { showNavLinks: false })}
    >
      {children}
    </DocsLayout>
  );
}
