'use client';

import { useEffect, useId, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';

export interface MermaidProps {
  chart: string;
}

export function Mermaid({ chart }: MermaidProps): React.ReactElement {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const renderChart = async () => {
      const mermaid = (await import('mermaid')).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
      });

      try {
        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${id.replace(/:/g, '')}`,
          chart.trim()
        );
        setSvg(renderedSvg);
      } catch (error) {
        console.error('Mermaid rendering error:', error);
        setSvg(`<pre style="color: red;">Mermaid Error: ${error}</pre>`);
      }
    };

    renderChart();
  }, [chart, id, resolvedTheme]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    document.body.style.overflow = '';
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen, closeModal]);

  return (
    <div className=''>
      <div
        className="group relative my-4 flex cursor-zoom-in justify-center overflow-x-auto rounded-lg border border-transparent transition-all hover:border-fd-border"
        onClick={openModal}
      >
        <div className="w-full flex justify-center" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="absolute bottom-2 right-2 rounded bg-fd-background/80 px-2 py-1 text-xs text-fd-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        </div>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={closeModal}
        >
          {/* Close button - fixed position relative to viewport */}
          <button
            onClick={closeModal}
            className="fixed right-4 top-4 z-60 rounded-full bg-fd-muted p-2 text-fd-foreground transition-colors hover:bg-red-600 hover:cursor-pointer"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div
            className="max-h-[90vh] max-w-[95vw] overflow-auto rounded-lg bg-fd-background p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="min-w-[80vw] [&_svg]:!max-w-none [&_svg]:!min-w-[1200px]"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
