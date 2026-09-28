// Punto de entrada del bundle de TipTap para la pestaña Hojas.
// Regenerar con: tools/tiptap/build.sh  → js/vendor/tiptap.min.js (global TT)
export { Editor, Node, Mark, Extension, mergeAttributes, InputRule } from '@tiptap/core';
export { PluginKey } from '@tiptap/pm/state';
export { default as StarterKit } from '@tiptap/starter-kit';
export { default as Mention } from '@tiptap/extension-mention';
export { default as Suggestion } from '@tiptap/suggestion';
export { default as TaskList } from '@tiptap/extension-task-list';
export { default as TaskItem } from '@tiptap/extension-task-item';
export { default as Placeholder } from '@tiptap/extension-placeholder';
