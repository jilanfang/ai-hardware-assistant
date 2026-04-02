# Mouser RF Front End Scraper Design

## Goal

Build a resumable Mouser scraper for the `RF Front End` category page that can collect as much stable product information as possible from the product list and detail pages, then export both machine-usable `JSON` and human-reviewable `CSV`.

## Scope

This design only covers:

- `https://www.mouser.com/c/semiconductors/integrated-circuits-ics/wireless-rf-integrated-circuits/rf-front-end/`
- product detail pages reached from that category page
- resumable scraping for one category
- structured export to `JSON` and `CSV`

This design does not cover:

- generic multi-category crawling
- Mouser API integration
- account login flows
- price/stock normalization across regions
- anti-bot escalation beyond browser-backed fixture capture and the existing `scrapling` parsing approach already used in this repo

## Why This Shape

The current repository already has a Python CLI script using `scrapling`, checked-in HTML fixtures, and Vitest script tests. The simplest path is to extend that pattern with one new scraper script rather than building a separate crawler subsystem.

The main risk is that direct HTTP requests to Mouser may receive a denied page while a real browser still renders the category correctly. So the design favors:

- fixture-backed parser coverage
- explicit sample-first execution
- resumable progress files
- conservative request pacing
- keeping a path open for browser-assisted fixture refresh when direct live fetch is denied

## User Outcome

The operator should be able to:

1. run a sample crawl for the first `N` products
2. inspect a generated `CSV`
3. rerun with `--resume` without losing already captured records
4. later increase the limit toward a full crawl of the category

## Data Contract

Each scraped product record should include, when available:

- `category_slug`
- `category_url`
- `listing_page`
- `listing_position`
- `detail_url`
- `mouser_part_number`
- `manufacturer`
- `manufacturer_part_number`
- `title`
- `description`
- `stock`
- `pricing`
- `datasheet_url`
- `image_url`
- `product_attributes`
- `category_path`
- `scraped_at`

`product_attributes` should remain a structured key-value map in JSON. In CSV it should be flattened into a stable string column so manual review is still easy.

## Architecture

The implementation should consist of one focused Python CLI script:

- fetch the RF Front End category page
- enumerate product links and lightweight list-level fields
- visit product detail pages
- merge list fields and detail fields into one product record
- persist incremental progress to disk
- export final `JSON` and `CSV`

The scraper should prefer the simplest live path first. If direct Mouser requests return a denied page or incomplete HTML, the implementation should support fixture-backed operation and keep browser-assisted fixture refresh as the fallback for development.

## Persistence and Resume

The scraper should write into a dedicated output directory under `lib/generated` so the results stay near other generated artifacts.

Suggested files:

- `lib/generated/mouser-rf-front-end-products.json`
- `lib/generated/mouser-rf-front-end-products.csv`
- `lib/generated/mouser-rf-front-end-progress.json`

The progress JSON should store enough state to resume safely:

- category URL
- last completed listing page
- completed product URLs
- current output path references
- last updated time

Resume should deduplicate by `detail_url`.

## Parsing Strategy

### Listing Page

Extract:

- product detail URL
- visible manufacturer and part number when present
- visible Mouser part number when present
- price snippet when present
- stock snippet when present
- listing position

### Detail Page

Extract:

- page title
- manufacturer
- Mouser part number
- manufacturer part number
- datasheet link
- image URL
- breadcrumb or category path
- product attributes table
- any visible availability or packaging summary that is stable

The parser should rely on semantic labels and headings, not row positions.

## CLI Contract

The first version should support:

- `--limit <N>`: stop after N product detail pages
- `--resume`: continue from progress state if present
- `--output-dir <path>`: override default output directory
- `--save-html`: optional raw HTML snapshot saving for debugging

Default behavior should be sample-friendly, not aggressive. Running with no flags should be safe for a small validation run.

## Testing Strategy

Tests should match the repository's existing pattern: Vitest drives the Python script.

The test plan should cover:

- category page parser extracts product URLs and basic list fields from fixtures
- detail page parser extracts stable fields from fixtures
- sample crawl writes both `JSON` and `CSV`
- resume mode skips already completed detail URLs

Tests should be fixture-first. Live network access should not be required for the normal test suite.

## Risks

- Mouser markup may change without notice
- direct non-browser requests may receive denied pages
- list-page fields may be less stable than detail-page fields
- full-category crawling may still require slower pacing than the sample run

## Recommended First Delivery

Deliver a single-category resumable scraper that defaults to small sample runs and proves:

- the field contract is useful
- the CSV is reviewable by a human
- the script can resume without re-fetching completed products

Only after that should the scraper expand toward broader Mouser RF traversal or additional distributors.
