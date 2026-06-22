'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from 'fumadocs-ui/components/ui/popover';
import { buttonVariants } from 'fumadocs-ui/components/ui/button';
import { usePathname } from 'fumadocs-core/framework';
import { ChevronDown, ExternalLinkIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

interface AskAiLabels {
  scira: string;
  chatgpt: string;
  claude: string;
  cursor: string;
}

interface AskAiPopoverProps {
  labels: AskAiLabels;
  children?: ReactNode;
}

const SciraIcon = (
  <svg viewBox="0 0 910 934" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-6" color="currentColor">
    <title>Scira AI</title>
    <path d="M647.66 197.78C569.13 189.05 525.5 145.42 516.77 66.88C508.05 145.42 464.42 189.05 385.88 197.78C464.42 206.5 508.05 250.13 516.77 328.67C525.5 250.13 569.13 206.5 647.66 197.78Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round"></path>
    <path d="M516.77 304.22C510.3 275.49 498.21 252.09 480.34 234.21C462.46 216.34 439.06 204.25 410.33 197.78C439.06 191.3 462.46 179.21 480.34 161.34C498.21 143.46 510.3 120.06 516.77 91.33C523.25 120.06 535.34 143.46 553.21 161.34C571.09 179.21 594.49 191.3 623.22 197.78C594.49 204.25 571.09 216.34 553.21 234.21C535.34 252.09 523.25 275.49 516.77 304.22Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"></path>
    <path d="M857.5 508.12C763.26 497.64 710.9 445.29 700.43 351.05C689.96 445.29 637.61 497.64 543.36 508.12C637.61 518.59 689.96 570.94 700.43 665.18C710.9 570.94 763.26 518.59 857.5 508.12Z" stroke="currentColor" strokeWidth="20" strokeLinejoin="round"></path>
    <path d="M700.43 615.96C691.85 589.05 678.58 566.36 660.38 548.17C642.19 529.97 619.5 516.7 592.59 508.12C619.5 499.53 642.19 486.26 660.38 468.07C678.58 449.87 691.85 427.18 700.43 400.27C709.02 427.18 722.29 449.87 740.48 468.07C758.67 486.26 781.37 499.53 808.27 508.12C781.37 516.7 758.67 529.97 740.48 548.17C722.29 566.36 709.02 589.05 700.43 615.96Z" stroke="currentColor" stroke-width="20" stroke-linejoin="round"></path>
    <path d="M889.95 121.24C831.05 114.69 798.33 81.97 791.78 23.07C785.24 81.97 752.52 114.69 693.61 121.24C752.52 127.78 785.24 160.5 791.78 219.4C798.33 160.5 831.05 127.78 889.95 121.24Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round"></path>
    <path d="M791.78 196.8C786.7 176.94 777.87 160.57 765.16 147.86C752.45 135.15 736.08 126.32 716.23 121.24C736.08 116.15 752.45 107.32 765.16 94.62C777.87 81.91 786.7 65.54 791.78 45.68C796.87 65.54 805.7 81.91 818.4 94.62C831.11 107.32 847.48 116.15 867.34 121.24C847.48 126.32 831.11 135.15 818.4 147.86C805.69 160.57 796.87 176.94 791.78 196.8Z" fill="currentColor" stroke="currentColor" stroke-width="8" stroke-linejoin="round"></path>
    <path d="M760.63 764.34C720.72 814.62 669.84 855.1 611.87 882.69C553.91 910.29 490.4 924.26 426.21 923.53C362.02 922.81 298.85 907.42 241.52 878.53C184.19 849.64 134.23 808.03 95.45 756.86C56.68 705.7 30.12 646.35 17.81 583.34C5.5 520.34 7.76 455.35 24.43 393.36C41.09 331.36 71.71 274 113.95 225.66C156.18 177.32 208.92 139.27 268.12 114.44" stroke="currentColor" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
);

const ChatGPTIcon = (
  <svg fill="currentColor" viewBox="0 0 24 24" role="img" xmlns="http://www.w3.org/2000/svg">
    <title>OpenAI</title>
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
  </svg>
);

const ClaudeIcon = (
  <svg fill="currentColor" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <title>Anthropic</title>
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
  </svg>
);

const CursorIcon = (
  <svg fill="currentColor" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <title>Cursor</title>
    <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
  </svg>
);

function buildItems(q: string, labels: AskAiLabels) {
  return [
    {
      key: 'scira',
      title: labels.scira,
      href: `https://scira.ai/?${new URLSearchParams({ q })}`,
      icon: SciraIcon,
    },
    {
      key: 'chatgpt',
      title: labels.chatgpt,
      href: `https://chatgpt.com/?${new URLSearchParams({ hints: 'search', q })}`,
      icon: ChatGPTIcon,
    },
    {
      key: 'claude',
      title: labels.claude,
      href: `https://claude.ai/new?${new URLSearchParams({ q })}`,
      icon: ClaudeIcon,
    },
    {
      key: 'cursor',
      title: labels.cursor,
      href: `https://cursor.com/link/prompt?${new URLSearchParams({ text: q })}`,
      icon: CursorIcon,
    },
  ];
}

export function AskAiPopover({ labels, children }: AskAiPopoverProps) {
  const pathname = usePathname();
  // Radix only mounts PopoverContent on the client when opened, so it is safe
  // to rely on `window` here for an absolute `.md` URL that AI tools can fetch.
  const items = useMemo(() => {
    const origin = typeof window === 'undefined' ? '' : window.location.origin;
    const q = `Read ${origin}${pathname}.md, I want to ask questions about it.`;
    return buildItems(q, labels);
  }, [pathname, labels]);

  return (
    <Popover>
      <PopoverTrigger
        className={`${buttonVariants({ color: 'secondary', size: 'sm' })} gap-2 data-[state=open]:bg-fd-accent data-[state=open]:text-fd-accent-foreground`}
      >
        {children ?? 'Ask AI'}
        <ChevronDown className="size-3.5 text-fd-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="center" className="flex flex-col">
        {items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            rel="noreferrer noopener"
            target="_blank"
            className="text-sm p-2 rounded-lg inline-flex items-center gap-2 hover:text-fd-accent-foreground hover:bg-fd-accent [&_svg]:size-4"
          >
            {item.icon}
            {item.title}
            <ExternalLinkIcon className="text-fd-muted-foreground size-3.5 ms-auto" />
          </a>
        ))}
      </PopoverContent>
    </Popover>
  );
}
