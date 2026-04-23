---
name: research-advisor
description: "Search papers, assess novelty, and scan research landscape to support discussion with evidence."
when_to_use: "When the user asks about related work, novelty of an idea, state of a field, or when you need evidence to back up a recommendation."
allowed-tools: Bash(curl *), Read, Write, Grep
user-invocable: false
---

## Research Intelligence Toolkit

Use these capabilities when the discussion needs evidence, not just opinion.

### Paper Search

When you need to check if something exists, find related work, or support a claim:

1. Search arXiv and Semantic Scholar for relevant papers
2. Use targeted queries: `"[method] [domain] [year-range]"`
3. Report: title, authors, year, venue, key finding (1 sentence)
4. Distinguish: peer-reviewed vs preprint, high-citation vs new

Trigger: user asks "has anyone done X?", "is this novel?", "what's the state of the art?", or you want to back up your own recommendation with evidence.

### Novelty Assessment

When the user proposes an idea and you need to gauge originality:

1. Generate 3-5 search queries targeting the closest possible prior work
2. Search both arXiv and Semantic Scholar
3. For each close match: state how it differs from the user's idea
4. Give a verdict:
   - **Novel** — no close match found; idea is original
   - **Incremental** — similar work exists, but user's angle has a clear differentiator
   - **Already done** — very close match exists; pivot or differentiate needed

Be honest. "Already done" is valuable feedback, not failure.

### Landscape Scan

When the user asks about a field, direction, or trend:

1. Search recent papers (last 2-3 years) on the topic
2. Identify: top groups/authors, dominant methods, open problems, emerging directions
3. Summarize in 5-10 sentences — enough to orient, not overwhelm
4. Note: which sub-areas are crowded vs under-explored

### Citation Hygiene

When you reference a paper in conversation:

- Only cite papers you have actually found via search in this session
- Never invent paper titles, authors, or results from memory
- If unsure whether something exists: search first, then cite or say "I couldn't find it"
