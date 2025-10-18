# @ckb-ccc/dob-render

CCC - CKBer's Codebase. Common Chains Connector's render SDK for DOB protocol.

This package provides rendering capabilities for DOB (Decentralized Object) protocol, allowing you to render DOB tokens as SVG images.

## Installation

```bash
npm install @ckb-ccc/dob-render
```

## Usage

```typescript
import {
  renderByTokenKey,
  renderByDobDecodeResponse,
} from "@ckb-ccc/dob-render";

// Render by token key
const svg = await renderByTokenKey("your-token-key");

// Render by DOB decode response
const svg = renderByDobDecodeResponse(renderOutput);
```

## API

### `renderByTokenKey(tokenKey: string, options?: RenderOptions)`

Renders a DOB token by its key.

### `renderByDobDecodeResponse(renderOutput: RenderOutput, props?: RenderProps)`

Renders a DOB token from a decoded response.

## Dependencies

- `satori` - SVG to image conversion
- `svgson` - SVG parsing
- `axios` - HTTP client for API calls
