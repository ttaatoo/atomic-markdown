# Welcome to Atomic Markdown

This sample is for **F5** / Extension Development Host. Open it with **Atomic Markdown: Open with Atomic Markdown** (the default text editor stays the default).

Raw markdown is the source of truth. Decorations are view-only — copy or save should match a textarea.

## Emphasis and lists

You can use *emphasis*, **strong**, `inline code`, ~~strike~~, and ==highlights==.

- Tight bullet
- Another item
  - Nested

1. Numbered
2. Still numbered

### Tasks

- [x] Scaffold the custom editor
- [ ] Toggle this checkbox
- [ ] Try reading mode from the editor title

## Table

| Feature        | v1 |
| -------------- | -- |
| Live preview   | yes |
| WYSIWYG tables | yes |
| Wiki links     | no |

Click a cell to edit it in place.

## Fences

```ts
export function greet(name: string): string {
  return `hello, ${name}`;
}
```

```python
def greet(name: str) -> str:
    return f"hello, {name}"
```

```json
{ "editor": "atomic-markdown" }
```

## Images and links

Relative image (rewritten with `webview.asWebviewUri`):

![Sample mark](./mark.svg)

Remote image:

![1×1](https://via.placeholder.com/48.png)

A [relative markdown link](./other.md) opens with `vscode.open`. An [external link](https://github.com/ttaatoo/atomic-markdown) opens outside the workbench.
