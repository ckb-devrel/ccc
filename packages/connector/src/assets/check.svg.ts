import { html } from "lit";

export const CHECK_SVG = html`<svg
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-linecap="round"
  stroke-linejoin="round"
  style="stroke-width: var(--check-stroke-width, 2.5)"
  aria-hidden="true"
>
  <path d="m20 6-11 11-5-5"></path>
</svg>`;
