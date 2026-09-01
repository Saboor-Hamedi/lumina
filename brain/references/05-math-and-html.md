# Math Expressions & HTML

Lumina supports mathematical formula rendering powered by KaTeX/LaTeX as well as custom HTML tags for advanced layouts.

---

## Mathematical Expressions

### Inline Math
Wrap mathematical formulas in single dollar signs `$...$`:

```markdown
Euler's identity is defined as $e^{i\pi} + 1 = 0$.
The mass-energy equivalence is $E = mc^2$.
```

### Display Block Math
Wrap display equations in double dollar signs `$$...$$`:

```markdown
$$
f(x) = \int_{-\infty}^{\infty} \hat{f}(\xi)\,e^{2 \pi i \xi x}\,d\xi
$$
```

### Matrices & Linear Algebra

```markdown
$$
\mathbf{A} = \begin{pmatrix}
a_{11} & a_{12} & \cdots & a_{1n} \\
a_{21} & a_{22} & \cdots & a_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
a_{m1} & a_{m2} & \cdots & a_{mn}
\end{pmatrix}
$$
```

### Summations & Limits

```markdown
$$
\lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e = \sum_{k=0}^{\infty} \frac{1}{k!}
$$
```

---

## HTML in Markdown

When Markdown syntax alone isn't enough, standard HTML elements can be used directly:

### Collapsible Accordions

```html
<details>
  <summary>Click to view system specifications</summary>
  <p>Lumina v1.0.36 runs on Electron 34 with React 19 and CodeMirror 6.</p>
</details>
```

### Subscript and Superscript

```html
Chemical formula: H<sub>2</sub>O and CO<sub>2</sub>
Exponential: 2<sup>10</sup> = 1024
```

### Text Highlighting & Badges

```html
<mark style="background: rgba(147, 51, 234, 0.2); color: #c084fc; padding: 2px 6px; border-radius: 4px;">
  Custom Highlight Badge
</mark>
```

### Keyboard Keys

```html
Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>X</kbd> to toggle highlighting.
Press <kbd>Ctrl</kbd> + <kbd>P</kbd> for Quick Switcher.
```
