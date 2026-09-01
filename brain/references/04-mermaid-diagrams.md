# Mermaid Diagrams

Lumina embeds a native Mermaid engine that renders text-defined diagrams directly into high-fidelity SVG graphics.

---

## Flowcharts

Create flowcharts with `graph TD` (top-down) or `graph LR` (left-to-right):

````markdown
```mermaid
graph TD
    A[Start Planning] --> B{Approved?}
    B -->|Yes| C[Execute Implementation]
    B -->|No| D[Refine Strategy]
    D --> B
    C --> E[Verify & Test]
    E --> F[Deploy]
```
````

### Node Shapes
- `[Rectangle]`
- `(Rounded Rectangle)`
- `([Pill Shape])`
- `[[Subroutine]]`
- `[(Database)]`
- `((Circle))`
- `>Asymmetric Flag]`
- `{Rhombus / Decision}`

---

## Sequence Diagrams

````markdown
```mermaid
sequenceDiagram
    autonumber
    actor User
    participant App as Lumina UI
    participant Vault as VaultStore
    participant FS as Local Filesystem

    User->>App: Open Note (Ctrl+P)
    App->>Vault: Query Note by Title
    Vault->>FS: Read Markdown Source
    FS-->>Vault: Raw Markdown Content
    Vault-->>App: Parse & Render AST
    App-->>User: Display Note in Editor
```
````

---

## Class Diagrams

````markdown
```mermaid
classDiagram
    class Note {
        +String id
        +String title
        +String code
        +Number updatedAt
        +save() Boolean
    }

    class VaultStore {
        +List~Note~ snippets
        +Note activeSnippet
        +selectNote(id)
        +deleteNote(id)
    }

    VaultStore "1" *-- "*" Note : manages
```
````

---

## State Diagrams

````markdown
```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Editing : User types
    Editing --> Saving : Debounce timer expires
    Saving --> Idle : Save acknowledged
    Saving --> Error : Write failure
    Error --> Idle : Retry
```
````

---

## Gantt Charts

````markdown
```mermaid
gantt
    title Lumina Polish Roadmap
    dateFormat  YYYY-MM-DD
    section Core Hooks
    Modular Extractions   :done,    des1, 2026-08-30, 2026-08-31
    Unit Test Coverage    :done,    des2, 2026-08-31, 2026-09-01
    section Features
    Documentation Engine  :active,  des3, 2026-09-01, 2d
    Graph Optimization    :         des4, after des3, 3d
```
````

---

## Entity Relationship Diagrams (ERD)

````markdown
```mermaid
erDiagram
    WORKSPACE ||--o{ NOTE : contains
    NOTE ||--o{ TAG : categorized_by
    NOTE ||--o{ ASSET : embeds
    
    NOTE {
        string id PK
        string title
        string content
        datetime created_at
    }
```
````
