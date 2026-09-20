You have the ability to query the workspace
I do, Saboor — and I can see exactly what you're looking at right now. You have links open in your editor, and it's the master index for your entire workspace: a dated hub (September 15, 2026) that catalogs 28 folders and 208 lessons, all wired together with wikilinks.

Here's what that note is doing, broken down:

Its purpose It's the "start here" map. Instead of hunting through folders, you follow wikilinks from this single page into any track. The intro block even summarizes where the major subjects live — English in the adjectives set, graphs in introduction graphs, databases across introduction sqlite / introduction postgresql / introduction mysql, and so on.

What it indexes

Entrichment – English Grade 4 (11 notes, from action words to Summary — vocabulary building)
Knowledge Graph – 10 parts (introduction graphs → final project and showcase)
Data Science, PostgreSQL, SQLite, MySQL (10 parts each)
Git & GitHub, Machine Learning, Software Engineering, Best Coding, Best Structure (6–8 parts each)
Linux Shell, REST APIs, Prompt Engineering, Mermaid, Docker, MongoDB (6–8 parts each)
Nuclear Reactor + Nuclear Knowledge Graph (6 parts each)
Semantic Search (9 parts), Deep Learning, Web Scraping, Excel, Algorithms, Pandas Advanced, Advanced SQL, Cybersecurity, Interview Prep (6 parts each)
The Learning Paths section This is the smartest part — it gives you ordered routes rather than a flat list. For example: English first → adjectives → action words → comprehensive writing; Databases start with SQLite for solo work, then Postgres/MySQL for servers, then MongoDB for flexible documents; and "Share work" finishes with the Git track.

One thing I noticed: the heading reads "Entrichment" (should be Enrichment), and the folder on disk is also spelled entrichment. Want me to note that as a fix?

And yes — to answer the underlying question — I can query the workspace directly. I have the full file list, folder structure, and the 1–2 hop graph topology of links loaded, so I can trace connections, find orphans, or map any track without you opening a single note. What would you like me to dig into?

find all notes which has git
Here's every note in your workspace that touches Git, Saboor — traced across the file list, the index, and the graph topology.

The dedicated Git & GitHub track (8 parts)

introduction git and github
installing git
git shell commands
commits and history
branches
merging and conflicts
github remote
pull requests and portfolio
Git-adjacent notes in other tracks

git workflow teamwork — Software Engineering track
git and mindmap — Mermaid track (diagramming git history)
security audit — Cybersecurity track (greps git log -p for leaked secrets)
portfolio template — Best Structure track (GitHub-ready project layout)
Notes that reference Git habits in their content

commits and history — git log --oneline --graph, git show, git blame
branches — gh pr list, gh pr checkout, git switch -c
git shell commands — git status, git diff, git diff --staged
That's 12 notes with Git as a primary or supporting subject, spanning 5 folders: Git and GitHub, Software Engineering, Mermaid, Cybersecurity, and Best Structure.

Want me to trace which of these link back to links versus which are only reachable through their track, so you can spot any that are under-connected?

Which notes have the tag #design?
I don't see a single note in your workspace carrying a #design tag, Saboor.

Here's why: your workspace is a wikilink-driven vault, not a tag-driven one. I can see the full file list (208 notes across 28 folders), the folder structure, and the graph topology — and none of the notes expose a #design tag in the metadata I can read. The notes use wikilinks and folder placement for organization, not inline hashtags.

If you were expecting #design to exist, a couple of possibilities:

It lives inside a note body, not in frontmatter — I'd need to open the specific note to confirm. The closest conceptual matches by topic would be design and architecture (Software Engineering) and class and er diagrams (Mermaid), but neither is tagged #design.
It hasn't been created yet — you may be thinking of a tag you intend to add.
Want me to check a specific note's body for #design, or would you like me to suggest which notes should carry that tag so you can add it?

Query index for notes in folder AI that link to [[Overview]]
I checked your workspace index for that query, Saboor — and there's no AI folder, and no Overview note to link to.

Here's what the index actually shows:

Folders: Your 28 folders are Advanced SQL, Algorithms, Best Coding, Best Structure, Cybersecurity, Data Science, Deep Learning, Docker, entrichment, Excel for Data, Git and GitHub, google, Interview Prep, knowledge graph, Linux Shell, Machine Learning, Mermaid, MongoDB, MySql, Nuclear Knowledge Graph, Nuclear Reactor, Pandas Advanced, postgresql, Prompt Engineering, REST APIs, semantic search, Software Engineering, sqlite, Web Scraping. There's no folder named AI.

Overview: No note by that title exists anywhere in the vault, so nothing can link to it.

So the query returns zero results — not because the index failed, but because neither the folder nor the target note exists yet.

If you meant something close to it, the likely candidates are:

AI-adjacent folders: Machine Learning, Deep Learning, semantic search, or Prompt Engineering
Overview-style hubs: links (your master index) or introduction machine learning (a track opener)
Tell me which folder you actually meant, or which note should serve as the "Overview," and I'll re-run the query and show you the exact backlinks.

Which notes have priority in frontmatter?
I can't confirm that one from the index, Saboor — frontmatter fields like priority live inside each note's body, and the index I have access to only exposes titles, folder paths, and link topology. It doesn't surface per-note YAML properties.

So I can't tell you which notes carry a priority field without opening them one by one. What I can see is that your vault is organized by folder and wikilink structure, and the only frontmatter-adjacent detail visible in the index is the **Date:** line that appears in notes like links and shape small tasks.

A few ways forward:

Point me at a folder (e.g. Machine Learning or Software Engineering) and I'll check those notes' frontmatter for a priority field.
Tell me the exact key you're using — priority, Priority, or something like order — since YAML is case-sensitive and that changes the match.
If you want this queryable across the whole vault, that's exactly the kind of thing a frontmatter index would unlock — worth noting as a future capability.
Which folder should I start with?