/**
 * The shared editor colour palette — a small set of named tints used for both
 * block colours (background `bg` / text `fg` props) and inline text runs
 * (highlight `hl` / text-colour `tc` attributes). Tokens (not raw hex) are
 * stored in the document and rendered as CSS classes (`obe-fg-*`, `obe-bg-*`,
 * `obe-hl-*`), so every colour adapts to light and dark themes via index.css.
 */
export interface ColorToken {
  id: string;
  label: string;
}

export const COLOR_TOKENS: readonly ColorToken[] = [
  {id: 'gray', label: 'Grey'},
  {id: 'brown', label: 'Brown'},
  {id: 'orange', label: 'Orange'},
  {id: 'yellow', label: 'Yellow'},
  {id: 'green', label: 'Green'},
  {id: 'blue', label: 'Blue'},
  {id: 'purple', label: 'Purple'},
  {id: 'pink', label: 'Pink'},
  {id: 'red', label: 'Red'},
];

const IDS = new Set(COLOR_TOKENS.map((c) => c.id));

/** Whether `v` is one of the known palette tokens (guards class names). */
export const isColorToken = (v: string | undefined | null): v is string => !!v && IDS.has(v);

/**
 * Export mirrors of index.css. Eight-digit hex retains tint alpha on any surface.
 * colors.test.ts guards every role/theme against CSS; static exports use light.
 */
type ExportColors = Record<string, {fg: string; bg: string; hl: string}>;

export const COLOR_EXPORT_HEX: ExportColors = {
  gray: {fg: '#737373', bg: '#8080801a', hl: '#8c8c8c47'},
  brown: {fg: '#835b3f', bg: '#b9764621', hl: '#bf75404d'},
  orange: {fg: '#b35e14', bg: '#ed7e1d21', hl: '#f48c2552'},
  yellow: {fg: '#976f11', bg: '#f3bc1626', hl: '#f9ce1f66'},
  green: {fg: '#2b8248', bg: '#34b25e21', hl: '#31c4624d'},
  blue: {fg: '#2073c5', bg: '#308ce821', hl: '#3994ef47'},
  purple: {fg: '#7941c8', bg: '#8954d424', hl: '#8e57db4d'},
  pink: {fg: '#ca2b7a', bg: '#df499421', hl: '#e64c994d'},
  red: {fg: '#ce2727', bg: '#df3a3a1f', hl: '#e4444447'},
};

export const COLOR_EXPORT_HEX_DARK: ExportColors = {
  gray: {fg: '#a8a8a8', bg: '#c7c7c71a', hl: '#9e9e9e4d'},
  brown: {fg: '#c59877', bg: '#c084592e', hl: '#b9764657'},
  orange: {fg: '#f0994c', bg: '#e886302e', hl: '#e680195c'},
  yellow: {fg: '#ecc551', bg: '#e8ba302e', hl: '#e6bd1957'},
  green: {fg: '#66cc88', bg: '#40bf6a2e', hl: '#39ac6057'},
  blue: {fg: '#6cabea', bg: '#3c8cdd33', hl: '#2f85da5c'},
  purple: {fg: '#b38de7', bg: '#9061d138', hl: '#824dcb61'},
  pink: {fg: '#e981b5', bg: '#d4549433', hl: '#d1478c5c'},
  red: {fg: '#e97777', bg: '#d7424233', hl: '#d435355c'},
};
