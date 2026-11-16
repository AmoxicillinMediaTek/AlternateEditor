import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  indentUnit,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  closeBrackets,
  closeBracketsKeymap,
  completeAnyWord,
  completionKeymap,
  autocompletion,
} from "@codemirror/autocomplete";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { editorTheme } from "./theme";
import type { Settings } from "@/lib/workspace/types";

export const languageCompartment = new Compartment();
export const settingsCompartment = new Compartment();

export function settingsExtensions(settings: Settings): Extension {
  const size = settings.fontSize;
  return [
    editorTheme(settings.theme),
    settings.wordWrap ? EditorView.lineWrapping : [],
    settings.highlightActiveLine ? highlightActiveLine() : [],
    settings.highlightActiveLine ? highlightActiveLineGutter() : [],
    EditorState.tabSize.of(settings.tabSize),
    indentUnit.of(" ".repeat(settings.tabSize)),
    EditorView.theme({
      "&": { fontSize: `${size}px` },
      ".cm-content": {
        fontFamily: "var(--font-mono)",
        lineHeight: "1.7",
        paddingTop: "10px",
        paddingBottom: "var(--editor-bottom-pad, 12px)",
        caretColor: "var(--accent)",
      },
      ".cm-line": { padding: "0 16px 0 10px" },
      ".cm-gutters": {
        fontFamily: "var(--font-mono)",
        fontSize: `${Math.max(10, size - 2)}px`,
        minWidth: "34px",
        userSelect: "none",
      },
      ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 4px" },
      ".cm-foldGutter .cm-gutterElement": { padding: "0 4px 0 0" },
      ".cm-scroller": { fontVariantLigatures: "contextual" },
    }),
  ];
}

const wordCompletion = autocompletion({
  activateOnTyping: true,
  maxRenderedOptions: 10,
  icons: false,
  override: [completeAnyWord],
});

const coreExtensions: Extension = [
  lineNumbers(),
  highlightSpecialChars(),
  history(),
  foldGutter({
    markerDOM(open) {
      const marker = document.createElement("span");
      marker.textContent = open ? "▾" : "▸";
      marker.style.opacity = open ? "0.9" : "1";
      marker.setAttribute("aria-hidden", "true");
      return marker;
    },
  }),
  drawSelection(),
  dropCursor(),
  EditorState.allowMultipleSelections.of(true),
  indentOnInput(),
  bracketMatching(),
  closeBrackets(),
  rectangularSelection(),
  crosshairCursor(),
  highlightSelectionMatches(),
  search({ top: true }),
  EditorView.contentAttributes.of({
    "aria-label": "Code editor",
    autocapitalize: "off",
    autocorrect: "off",
    spellcheck: "false",
    translate: "no",
  }),
  EditorView.editorAttributes.of({ class: "cm-quarry" }),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    indentWithTab,
  ]),
];

export function createEditorState(
  doc: string,
  settings: Settings,
  extras: Extension[] = [],
): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      coreExtensions,
      languageCompartment.of([]),
      wordCompletion,
      settingsCompartment.of(settingsExtensions(settings)),
      ...extras,
    ],
  });
}

export function lineColumnAt(state: EditorState, position: number): {
  line: number;
  column: number;
} {
  const line = state.doc.lineAt(Math.min(Math.max(position, 0), state.doc.length));
  return { line: line.number, column: position - line.from + 1 };
}
