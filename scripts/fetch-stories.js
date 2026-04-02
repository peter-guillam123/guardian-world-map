import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const STORIES_PATH = join(ROOT, "data", "stories.json");

const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const LOOKBACK_MINUTES = 70;
const MAX_STORY_AGE_HOURS = 24;
const BATCH_SIZE = 15;

const VALID_CATEGORIES = new Set([
  "conflict", "climate", "politics", "economy",
  "health", "culture", "sport", "tech", "other",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadExistingStories() {
  try {
    const raw = readFileSync(STORIES_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.stories)) return data.stories;
  } catch {
    // File missing or corrupt — start fresh
  }
  return [];
}

function saveStories(stories) {
  mkdirSync(dirname(STORIES_PATH), { recursive: true });
  const data = {
    meta: {
      generated_at: new Date().toISOString(),
      story_count: stories.length,
      oldest_story: stories.length
        ? stories.reduce((a, b) =>
            a.published < b.published ? a : b
          ).published
        : null,
      newest_story: stories.length
        ? stories.reduce((a, b) =>
            a.published > b.published ? a : b
          ).published
        : null,
      window_hours: MAX_STORY_AGE_HOURS,
    },
    stories,
  };
  writeFileSync(STORIES_PATH, JSON.stringify(data, null, 2) + "\n");
}

function pruneOld(stories) {
  const cutoff = Date.now() - MAX_STORY_AGE_HOURS * 60 * 60 * 1000;
  return stories.filter((s) => Date.parse(s.published) > cutoff);
}

// ---------------------------------------------------------------------------
// Guardian API
// ---------------------------------------------------------------------------

async function fetchGuardianArticles() {
  const now = new Date();
  const fromDate = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const params = new URLSearchParams({
    "from-date": fromDate,
    "order-by": "newest",
    "page-size": "50",
    "show-fields":
      "headline,standfirst,trailText,bodyText,thumbnail,shortUrl,wordcount",
    "show-tags": "keyword",
    "api-key": GUARDIAN_API_KEY,
  });

  const url = `https://content.guardianapis.com/search?${params}`;
  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Guardian API error: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  const results = json.response?.results ?? [];

  // Filter to articles within the lookback window
  const cutoff = Date.now() - LOOKBACK_MINUTES * 60 * 1000;
  return results.filter((r) => Date.parse(r.webPublicationDate) > cutoff);
}

// ---------------------------------------------------------------------------
// Claude API — location extraction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a geolocation extraction engine for news articles. For each article, extract:

1. location_name: The primary geographic location (city, region, or country). If multiple locations, pick the most prominent one.
2. lat: Latitude (decimal degrees, 4 decimal places)
3. lng: Longitude (decimal degrees, 4 decimal places)
4. category: One of: conflict, climate, politics, economy, health, culture, sport, tech, other
5. significance: Integer 1-5 (1=routine local, 2=notable national, 3=significant international, 4=major global, 5=breaking crisis)
6. summary: One sentence, max 120 characters, capturing the story essence.

Rules:
- If the article has no clear geographic location (opinion pieces, abstract features), return location_name as null.
- For UK domestic news without a specific city, use London (51.5074, -0.1278).
- For US domestic news without a specific city, use Washington DC (38.9072, -77.0369).
- For Australian domestic news without a specific city, use Sydney (-33.8688, 151.2093).
- For articles about international organizations (UN, WHO, EU), use their HQ city.
- Use well-known coordinates for major cities. Do not invent coordinates for obscure locations — use the nearest notable city.

Respond ONLY with a JSON array. No markdown fences, no explanation.`;

function buildBatchInput(articles) {
  return articles.map((a) => ({
    id: a.id,
    headline: a.fields?.headline ?? "",
    standfirst: a.fields?.standfirst ?? "",
    trailText: a.fields?.trailText ?? "",
    bodyExcerpt: (a.fields?.bodyText ?? "").slice(0, 300),
    sectionId: a.sectionId ?? "",
    tags: (a.tags ?? []).map((t) => t.id?.split("/").pop()).filter(Boolean),
  }));
}

async function extractLocations(articles) {
  if (!articles.length) return [];

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const batches = [];

  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    batches.push(articles.slice(i, i + BATCH_SIZE));
  }

  const allResults = [];

  for (const batch of batches) {
    const input = buildBatchInput(batch);
    try {
      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      });

      let text = msg.content[0]?.text ?? "[]";
      // Strip markdown fences if present
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) allResults.push(...parsed);
    } catch (err) {
      console.error("Claude API error for batch:", err.message);
    }
  }

  return allResults;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateStory(extracted, articlesById) {
  const { id, location_name, lat, lng, category, significance, summary } =
    extracted;

  if (!location_name) return null; // No geographic location — skip
  if (!articlesById.has(id)) return null;
  if (typeof lat !== "number" || lat < -90 || lat > 90) return null;
  if (typeof lng !== "number" || lng < -180 || lng > 180) return null;
  if (!VALID_CATEGORIES.has(category)) return null;
  if (!Number.isInteger(significance) || significance < 1 || significance > 5)
    return null;
  if (!summary || typeof summary !== "string") return null;

  const article = articlesById.get(id);
  return {
    id,
    headline: article.fields?.headline ?? "",
    summary: summary.slice(0, 200),
    url: article.fields?.shortUrl ?? article.webUrl ?? "",
    thumbnail: article.fields?.thumbnail ?? null,
    published: article.webPublicationDate,
    location: { name: location_name, lat, lng },
    category,
    significance,
    section: article.sectionId ?? "news",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[${new Date().toISOString()}] Starting fetch-stories run`);

  // 1. Load existing stories and build dedup set
  let existing = loadExistingStories();
  const existingIds = new Set(existing.map((s) => s.id));
  console.log(`  Loaded ${existing.length} existing stories`);

  // 2. Prune old stories
  existing = pruneOld(existing);
  console.log(`  After pruning: ${existing.length} stories within 24h window`);

  // 3. Fetch new articles from Guardian
  let articles = [];
  if (GUARDIAN_API_KEY) {
    articles = await fetchGuardianArticles();
    console.log(`  Guardian returned ${articles.length} recent articles`);
  } else {
    console.warn("  GUARDIAN_API_KEY not set — skipping fetch");
  }

  // 4. Deduplicate
  const newArticles = articles.filter((a) => !existingIds.has(a.id));
  console.log(`  ${newArticles.length} new articles after dedup`);

  if (newArticles.length === 0) {
    // Still save to update meta.generated_at and prune old stories
    saveStories(existing);
    console.log("  No new articles — saved pruned stories.json");
    return;
  }

  // 5. Extract locations via Claude
  let extracted = [];
  if (ANTHROPIC_API_KEY) {
    extracted = await extractLocations(newArticles);
    console.log(`  Claude extracted ${extracted.length} location results`);
  } else {
    console.warn("  ANTHROPIC_API_KEY not set — skipping extraction");
  }

  // 6. Validate and build story objects
  const articlesById = new Map(newArticles.map((a) => [a.id, a]));
  let added = 0;
  let skipped = 0;

  for (const ext of extracted) {
    const story = validateStory(ext, articlesById);
    if (story) {
      existing.push(story);
      added++;
    } else {
      skipped++;
    }
  }

  console.log(`  Added ${added} stories, skipped ${skipped} (no location or invalid)`);

  // 7. Save
  saveStories(existing);
  console.log(`  Saved ${existing.length} total stories to stories.json`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  // Don't exit with error code — let the workflow continue to commit pruned stories
  const existing = pruneOld(loadExistingStories());
  saveStories(existing);
  console.log("  Saved pruned stories.json after error");
});
