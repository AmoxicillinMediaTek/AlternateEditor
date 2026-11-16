import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import type { ThemeName } from "@/lib/workspace/types";

const darkChrome = EditorView.theme(
  {
    "&": {
      color: "#e6e8ea",
      backgroundColor: "var(--editor-bg)",
      height: "100%",
    },
    ".cm-scroller": { overflow: "auto", overscrollBehavior: "contain" },
    ".cm-content": { caretColor: "#e0a458" },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#e0a458",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(224, 164, 88, 0.24)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.028)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#5d6771",
      borderRight: "1px solid #20262c",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#c9d1d8" },
    ".cm-foldGutter .cm-gutterElement": { color: "#6f7a84" },
    ".cm-foldPlaceholder": {
      backgroundColor: "#22282e",
      border: "1px solid #333c45",
      color: "#9aa3ad",
      padding: "0 5px",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      backgroundColor: "#171c21",
      border: "1px solid #2d353d",
      color: "#e6e8ea",
      borderRadius: "6px",
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      maxHeight: "220px",
    },
    ".cm-tooltip-autocomplete > ul > li": {
      padding: "7px 10px",
      lineHeight: "1.3",
    },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(224, 164, 88, 0.16)",
      color: "#f4f6f7",
    },
    ".cm-completionLabel": { color: "inherit" },
    ".cm-completionMatchedText": {
      color: "#e0a458",
      textDecoration: "none",
      fontWeight: "600",
    },
    ".cm-completionDetail": { color: "#7d8790", fontStyle: "normal", marginLeft: "8px" },
    ".cm-searchMatch": {
      backgroundColor: "rgba(224, 164, 88, 0.22)",
      outline: "1px solid rgba(224, 164, 88, 0.45)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(224, 164, 88, 0.42)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(127, 200, 169, 0.14)" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(127, 200, 169, 0.16)",
      outline: "1px solid rgba(127, 200, 169, 0.4)",
    },
    ".cm-nonmatchingBracket": { color: "#e2725b" },
    ".cm-panels": {
      backgroundColor: "#13171b",
      color: "#e6e8ea",
      borderColor: "#262d34",
    },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #262d34" },
    ".cm-panel.cm-search": {
      fontFamily: "var(--font-ui)",
      fontSize: "12px",
      padding: "10px 12px",
    },
    ".cm-textfield": {
      backgroundColor: "#0d1114",
      border: "1px solid #333c45",
      borderRadius: "4px",
      color: "#e6e8ea",
      padding: "6px 8px",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      outline: "none",
    },
    ".cm-textfield:focus": { borderColor: "#e0a458" },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "#21272d",
      border: "1px solid #333c45",
      borderRadius: "4px",
      color: "#e6e8ea",
      fontSize: "12px",
      padding: "5px 10px",
      textTransform: "none",
    },
    ".cm-button:hover": { backgroundColor: "#2a323a" },
    ".cm-panel label": { color: "#b7c0c8" },
    ".cm-panel .cm-button": { cursor: "pointer" },
    ".cm-panel button[name=close]": {
      color: "#9aa3ad",
      cursor: "pointer",
      right: "8px",
      top: "8px",
    },
  },
  { dark: true },
);

const lightChrome = EditorView.theme(
  {
    "&": {
      color: "#1b1f24",
      backgroundColor: "var(--editor-bg)",
      height: "100%",
    },
    ".cm-scroller": { overflow: "auto", overscrollBehavior: "contain" },
    ".cm-content": { caretColor: "#9a5b1e" },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#9a5b1e",
      borderLeftWidth: "2px",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgba(154, 91, 30, 0.2)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(20, 30, 40, 0.035)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#8b949d",
      borderRight: "1px solid #e3e6ea",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#31383f" },
    ".cm-foldGutter .cm-gutterElement": { color: "#8b949d" },
    ".cm-foldPlaceholder": {
      backgroundColor: "#eef1f4",
      border: "1px solid #d7dce1",
      color: "#5b6570",
      padding: "0 5px",
      borderRadius: "3px",
    },
    ".cm-tooltip": {
      backgroundColor: "#ffffff",
      border: "1px solid #d9dee3",
      color: "#1b1f24",
      borderRadius: "6px",
      boxShadow: "0 12px 28px rgba(20, 28, 36, 0.16)",
      overflow: "hidden",
    },
    ".cm-tooltip-autocomplete > ul": {
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      maxHeight: "220px",
    },
    ".cm-tooltip-autocomplete > ul > li": { padding: "7px 10px", lineHeight: "1.3" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
      backgroundColor: "rgba(154, 91, 30, 0.12)",
      color: "#1b1f24",
    },
    ".cm-completionMatchedText": {
      color: "#9a5b1e",
      textDecoration: "none",
      fontWeight: "600",
    },
    ".cm-completionDetail": { color: "#6f7a84", fontStyle: "normal", marginLeft: "8px" },
    ".cm-searchMatch": {
      backgroundColor: "rgba(200, 140, 60, 0.22)",
      outline: "1px solid rgba(154, 91, 30, 0.35)",
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: "rgba(200, 140, 60, 0.45)",
    },
    ".cm-selectionMatch": { backgroundColor: "rgba(60, 140, 130, 0.12)" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "rgba(60, 140, 130, 0.12)",
      outline: "1px solid rgba(60, 140, 130, 0.35)",
    },
    ".cm-nonmatchingBracket": { color: "#b3442e" },
    ".cm-panels": {
      backgroundColor: "#f1f3f5",
      color: "#1b1f24",
      borderColor: "#d9dee3",
    },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid #d9dee3" },
    ".cm-panel.cm-search": {
      fontFamily: "var(--font-ui)",
      fontSize: "12px",
      padding: "10px 12px",
    },
    ".cm-textfield": {
      backgroundColor: "#ffffff",
      border: "1px solid #ccd3da",
      borderRadius: "4px",
      color: "#1b1f24",
      padding: "6px 8px",
      fontFamily: "var(--font-mono)",
      fontSize: "12px",
      outline: "none",
    },
    ".cm-textfield:focus": { borderColor: "#9a5b1e" },
    ".cm-button": {
      backgroundImage: "none",
      backgroundColor: "#e9edf0",
      border: "1px solid #ccd3da",
      borderRadius: "4px",
      color: "#1b1f24",
      fontSize: "12px",
      padding: "5px 10px",
      textTransform: "none",
    },
    ".cm-button:hover": { backgroundColor: "#dfe5e9" },
    ".cm-panel label": { color: "#4a545e" },
    ".cm-panel .cm-button": { cursor: "pointer" },
    ".cm-panel button[name=close]": {
      color: "#6f7a84",
      cursor: "pointer",
      right: "8px",
      top: "8px",
    },
  },
  { dark: false },
);

const darkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: "#e3a76a" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "#a8c7a0" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#dda6ac" },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "#6e7a84",
    fontStyle: "italic",
  },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: "#8ec3cb" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "#d6c48f" },
  { tag: [t.propertyName, t.attributeName], color: "#b9c7ce" },
  { tag: [t.variableName, t.self, t.definition(t.variableName)], color: "#e6e8ea" },
  { tag: [t.operator, t.punctuation, t.separator, t.derefOperator], color: "#98a2ac" },
  { tag: [t.bracket, t.brace, t.squareBracket, t.paren, t.angleBracket], color: "#8893a0" },
  { tag: [t.tagName, t.angleBracket], color: "#e3a76a" },
  { tag: [t.meta, t.annotation, t.processingInstruction], color: "#9aa3ad" },
  { tag: [t.heading], color: "#f1f3f4", fontWeight: "600" },
  { tag: [t.strong], color: "#f1f3f4", fontWeight: "600" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.link, t.url], color: "#8ec3cb", textDecoration: "underline" },
  { tag: t.invalid, color: "#e2725b" },
]);

const lightHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword], color: "#8a4a12" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "#3e6b45" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#93474f" },
  {
    tag: [t.comment, t.lineComment, t.blockComment, t.docComment],
    color: "#77818b",
    fontStyle: "italic",
  },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.labelName], color: "#2f6470" },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "#6b5a1e" },
  { tag: [t.propertyName, t.attributeName], color: "#46555f" },
  { tag: [t.variableName, t.self, t.definition(t.variableName)], color: "#1b1f24" },
  { tag: [t.operator, t.punctuation, t.separator], color: "#5f6a73" },
  { tag: [t.bracket, t.brace, t.squareBracket, t.paren, t.angleBracket], color: "#6f7a84" },
  { tag: [t.tagName, t.angleBracket], color: "#8a4a12" },
  { tag: [t.meta, t.annotation, t.processingInstruction], color: "#5b6570" },
  { tag: [t.heading], color: "#101418", fontWeight: "600" },
  { tag: [t.strong], fontWeight: "600" },
  { tag: [t.emphasis], fontStyle: "italic" },
  { tag: [t.link, t.url], color: "#2f6470", textDecoration: "underline" },
  { tag: t.invalid, color: "#b3442e" },
]);

export function editorTheme(theme: ThemeName): Extension {
  return [
    theme === "dark" ? darkChrome : lightChrome,
    syntaxHighlighting(theme === "dark" ? darkHighlight : lightHighlight),
  ];
}
