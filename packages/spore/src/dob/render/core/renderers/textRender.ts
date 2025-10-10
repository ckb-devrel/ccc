import satori from "satori";
import { FONTS } from "../../config/fonts.js";
import {
  ALIGNMENT_MAP,
  FONT_STYLES,
  FONT_WEIGHTS,
  RENDER_CONSTANTS,
} from "../../types/constants.js";
import type {
  FontConfiguration,
  TextItem,
  TextRenderOptions,
} from "../../types/core.js";
import type { RenderElement } from "../../types/internal.js";
import { base64ToArrayBuffer } from "../../utils/string.js";

/**
 * Font configuration with default values
 */
const DEFAULT_FONTS: FontConfiguration = {
  regular: base64ToArrayBuffer(FONTS.TurretRoadMedium),
  italic: base64ToArrayBuffer(FONTS.TurretRoadMedium),
  bold: base64ToArrayBuffer(FONTS.TurretRoadBold),
  boldItalic: base64ToArrayBuffer(FONTS.TurretRoadBold),
};

/**
 * Text renderer with improved structure and error handling
 */
export class TextRenderer {
  private readonly fonts: FontConfiguration;

  constructor(fonts?: FontConfiguration) {
    this.fonts = fonts || DEFAULT_FONTS;
  }

  /**
   * Renders text to SVG
   */
  async render(options: TextRenderOptions): Promise<string> {
    try {
      const children = this.buildRenderElements(options.items);
      const container = this.buildContainer(children, options.bgColor);

      return await satori(container, this.getSatoriOptions());
    } catch (error) {
      throw new Error(
        `Failed to render text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Builds render elements from text items
   */
  private buildRenderElements(items: readonly TextItem[]): RenderElement[] {
    const elements: RenderElement[] = [];

    for (const item of items) {
      const element = this.createTextElement(item);

      if (this.shouldAppendToPrevious(element, elements)) {
        this.appendToPreviousElement(element, elements);
      } else {
        elements.push(element);
        this.addBreakLines(item, elements);
      }
    }

    return elements;
  }

  /**
   * Creates a text element from a text item
   */
  private createTextElement(item: TextItem): RenderElement {
    const justifyContent =
      ALIGNMENT_MAP[item.parsedStyle.alignment as keyof typeof ALIGNMENT_MAP];

    return {
      key: item.name,
      type: "p",
      props: {
        children: item.text,
        style: {
          ...item.style,
          display: "flex",
          justifyContent,
          flexWrap: "wrap",
          width: "100%",
          margin: 0,
        },
      },
    };
  }

  /**
   * Determines if an element should be appended to the previous one
   */
  private shouldAppendToPrevious(
    _element: RenderElement,
    _elements: RenderElement[],
  ): boolean {
    // This would need to be implemented based on the original logic
    // For now, returning false to maintain current behavior
    return false;
  }

  /**
   * Appends element to the previous element
   */
  private appendToPreviousElement(
    element: RenderElement,
    elements: RenderElement[],
  ): void {
    const lastElement = elements[elements.length - 1];
    if (!lastElement) return;

    element.type = "span";
    delete element.props.style.width;
    element.props.style.display = "block";

    if (Array.isArray(lastElement.props.children)) {
      lastElement.props.children.push(element);
    } else {
      lastElement.props.children = [lastElement.props.children, element];
    }
  }

  /**
   * Adds break lines for an item
   */
  private addBreakLines(item: TextItem, elements: RenderElement[]): void {
    for (let i = 1; i < item.parsedStyle.breakLine; i++) {
      elements.push({
        key: `${item.name}${i}`,
        type: "p",
        props: {
          children: "",
          style: {
            height: "36px",
            margin: 0,
          },
        },
      });
    }
  }

  /**
   * Builds the main container element
   */
  private buildContainer(
    children: RenderElement[],
    bgColor: string,
  ): RenderElement {
    return {
      key: "container",
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
          background: bgColor,
          color: RENDER_CONSTANTS.DEFAULT_TEXT_COLOR,
          lineHeight: RENDER_CONSTANTS.DEFAULT_LINE_HEIGHT,
          fontSize: `${RENDER_CONSTANTS.DEFAULT_FONT_SIZE}px`,
          padding: RENDER_CONSTANTS.DEFAULT_PADDING,
          minHeight: `${RENDER_CONSTANTS.MIN_HEIGHT}px`,
          textAlign: "center",
        },
        children: [...children],
      },
    };
  }

  /**
   * Gets Satori configuration options
   */
  private getSatoriOptions() {
    return {
      width: RENDER_CONSTANTS.CANVAS_WIDTH,
      fonts: [
        {
          name: "TurretRoad",
          data: this.fonts.regular,
          weight: FONT_WEIGHTS.NORMAL,
          style: FONT_STYLES.NORMAL,
        },
        {
          name: "TurretRoad",
          data: this.fonts.bold,
          weight: FONT_WEIGHTS.BOLD,
          style: FONT_STYLES.NORMAL,
        },
        {
          name: "TurretRoad",
          data: this.fonts.italic,
          weight: FONT_WEIGHTS.NORMAL,
          style: FONT_STYLES.ITALIC,
        },
        {
          name: "TurretRoad",
          data: this.fonts.boldItalic,
          weight: FONT_WEIGHTS.BOLD,
          style: FONT_STYLES.ITALIC,
        },
      ],
    };
  }
}

/**
 * Renders text to SVG (backward compatibility)
 */
export async function renderTextSvg(
  options: TextRenderOptions & { font?: FontConfiguration },
): Promise<string> {
  const renderer = new TextRenderer(options.font);
  return renderer.render(options);
}

/**
 * Legacy interface for backward compatibility
 */
export interface RenderProps extends TextRenderOptions {
  font?: FontConfiguration;
}
