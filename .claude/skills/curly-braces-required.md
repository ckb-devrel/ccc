---
name: curly-braces-required
description: This skill applies to every task in this project. It mandates that Claude must ALWAYS wrap control flow bodies (`if`, `else`, `else if`, `for`, `while`, `do`) in curly braces `{}`, even when the body is a single statement. Single-line forms like `if (x) return;` are NEVER acceptable.
version: 1.0.0
---

# Curly Braces Required on All Control Flow Bodies

Every `if`, `else`, `else if`, `for`, `while`, and `do` body **must** be enclosed in `{}`, regardless of how many statements it contains.

## Forbidden patterns

```ts
if (condition) return;
if (condition) doSomething();
for (const x of xs) process(x);
while (running) tick();
```

## Required patterns

```ts
if (condition) {
  return;
}

if (condition) {
  doSomething();
}

for (const x of xs) {
  process(x);
}

while (running) {
  tick();
}
```

## Applies to

- All TypeScript / JavaScript files in this repo
- All branches: `if`, `else if`, `else`, ternary bodies are exempt (they are expressions, not statements), but every statement-level branch needs braces
- Early returns, `continue`, `break`, `throw` — no exceptions

## When editing existing code

If you touch a file that already contains brace-free control flow in the lines you are modifying or in immediately surrounding context, fix those occurrences in the same edit. Do not reformat unrelated lines far from your change.

## This rule is unconditional

Do not omit braces even if:
- The body is `return;`, `continue;`, or `break;` — one of the shortest possible statements.
- The original code you are based on uses the brace-free style.
- A linter or formatter would accept the brace-free form.
- The surrounding code uses the brace-free style consistently.
