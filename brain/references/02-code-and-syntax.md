# Code Blocks & Syntax Highlighting

Lumina supports full syntax highlighting, language badges, and 1-click copy for over 150 programming languages.

---

## Inline Code

Wrap snippets, filenames, or commands in single backticks:

```markdown
Use `const x = 42;` to define immutable constants.
Run `npm run dev` to launch the development server.
```

---

## Fenced Code Blocks

Fenced code blocks are created with triple backticks (` ``` `) or tildes (`~~~`):

````markdown
```javascript
function calculateScore(items) {
  return items.reduce((total, item) => total + item.value, 0);
}
console.log(calculateScore([{ value: 10 }, { value: 25 }]));
```
````

---

## Syntax Highlighting by Language

Specify the language tag immediately after the opening triple backticks:

### JavaScript & TypeScript
````markdown
```typescript
interface UserProfile {
  id: string;
  name: string;
  roles: Array<'admin' | 'editor' | 'viewer'>;
}

const currentUser: UserProfile = {
  id: 'usr_88192',
  name: 'Alex Developer',
  roles: ['admin', 'editor']
};
```
````

### Python
````markdown
```python
import math

def calculate_hypotenuse(a: float, b: float) -> float:
    """Calculates hypotenuse using Pythagorean theorem."""
    return math.sqrt(a**2 + b**2)

print(f"Hypotenuse: {calculate_hypotenuse(3.0, 4.0)}")
```
````

### HTML & CSS
````markdown
```html
<div class="card-container">
  <h2 class="card-title">Welcome to Lumina</h2>
  <p class="card-description">High-performance knowledge engine.</p>
</div>
```

```css
.card-container {
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: var(--bg-panel);
  border-radius: 6px;
  border: 1px solid var(--border-dim);
}
```
````

### Rust
````markdown
```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum of numbers: {}", sum);
}
```
````

### SQL
````markdown
```sql
SELECT 
    users.id, 
    users.username, 
    COUNT(notes.id) AS total_notes
FROM users
LEFT JOIN notes ON notes.user_id = users.id
WHERE users.active = true
GROUP BY users.id, users.username
ORDER BY total_notes DESC;
```
````

---

## Supported Language Identifiers

| Language | Identifiers |
|----------|-------------|
| JavaScript / TS | `js`, `javascript`, `ts`, `typescript`, `jsx`, `tsx` |
| Python | `py`, `python` |
| Web | `html`, `css`, `scss`, `json`, `yaml`, `yml` |
| Systems | `rust`, `rs`, `go`, `golang`, `cpp`, `c`, `csharp`, `cs` |
| Shell / Scripts | `bash`, `sh`, `zsh`, `powershell`, `ps1` |
| Database | `sql`, `graphql`, `prisma` |
| Markup | `markdown`, `md`, `latex`, `tex`, `mermaid` |
