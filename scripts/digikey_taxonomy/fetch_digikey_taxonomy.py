import json
import os
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from scrapling import Selector
from scrapling.fetchers import StealthyFetcher


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = ROOT / "lib" / "generated" / "digikey-taxonomy.json"
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
)


@dataclass
class ParameterField:
    label: str
    normalizedName: str


@dataclass
class CategoryTemplate:
    slug: str
    sourceUrl: str
    categoryPath: List[str]
    matchSignals: List[str]
    parameterFields: List[ParameterField]


TARGET_CATEGORIES = [
    {
        "slug": "rf-front-end-lna-pa",
        "url": "https://www.digikey.com/en/products/filter/rf-front-end-lna-pa/876",
        "matchSignals": [
            "wlan front-end module",
            "front-end module",
            "transmit gain",
            "receive gain",
            "wlan",
            "wi-fi",
        ],
    },
    {
        "slug": "voltage-regulators-dc-dc-switching-regulators",
        "url": "https://www.digikey.com/en/products/filter/power-management-pmic/voltage-regulators-dc-dc-switching-regulators/739",
        "matchSignals": [
            "buck converter",
            "switching regulator",
            "input voltage",
            "output current",
            "switching frequency",
        ],
    },
    {
        "slug": "voltage-regulators-linear-low-drop-out-ldo-regulators",
        "url": "https://www.digikey.com/en/products/filter/power-management-pmic/voltage-regulators-linear-low-drop-out-ldo-regulators/699",
        "matchSignals": [
            "low-dropout",
            "ldo",
            "linear regulator",
            "dropout",
            "adjustable output",
            "fixed output",
        ],
    },
]


def disable_proxy_env() -> None:
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        os.environ.pop(key, None)


def normalize_whitespace(value: str) -> str:
    return " ".join(value.split()).strip()


def slug_to_fixture_name(slug: str) -> str:
    return f"{slug}.html"


def get_cf_clearance_from_env() -> str | None:
    raw = os.environ.get("DIGIKEY_CF_CLEARANCE", "").strip()
    return raw or None


def get_cf_clearance_from_playwright() -> str | None:
    try:
        result = subprocess.run(
            ["playwright-cli", "cookie-get", "cf_clearance"],
            check=False,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
    except FileNotFoundError:
        return None

    output = (result.stdout or "") + "\n" + (result.stderr or "")
    match = re.search(r"cf_clearance=([^ \n]+)", output)
    return match.group(1) if match else None


def fetch_html_with_cookie(url: str, cf_clearance: str) -> str:
    try:
        result = subprocess.run(
            [
                "curl",
                "-sL",
                url,
                "-H",
                f"user-agent: {USER_AGENT}",
                "-H",
                f"cookie: cf_clearance={cf_clearance}",
            ],
            check=True,
            capture_output=True,
            text=True,
            cwd=ROOT,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            f"DigiKey blocked or challenged the request for {url}. Refresh DIGIKEY_CF_CLEARANCE and try again."
        ) from exc
    html = result.stdout
    if "Just a moment" in html or "执行安全验证" in html:
        raise RuntimeError(
            f"DigiKey blocked or challenged the request for {url}. Refresh DIGIKEY_CF_CLEARANCE and try again."
        )
    return html


def fetch_html(url: str, cf_clearance: str | None) -> str:
    disable_proxy_env()
    if cf_clearance:
        return fetch_html_with_cookie(url, cf_clearance)

    try:
        page = StealthyFetcher.fetch(url, headless=True, network_idle=True, google_search=False, timeout=30000)
    except Exception as exc:  # pragma: no cover - external browser/runtime failure
        raise RuntimeError(
            "Unable to fetch DigiKey without Cloudflare clearance. "
            "Set DIGIKEY_CF_CLEARANCE or pass the challenge in a real browser first."
        ) from exc

    if page.status >= 400 or "执行安全验证" in (page.text or "") or "Just a moment" in (page.text or ""):
        raise RuntimeError(
            f"DigiKey blocked the request for {url}. Set DIGIKEY_CF_CLEARANCE or pass the challenge in a real browser first."
        )
    return page.html_content


def parse_category_path(selector: Selector) -> List[str]:
    for script_node in selector.xpath('//script[@type="application/ld+json"]/text()'):
        raw = (script_node.text or "").strip()
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        graph = payload.get("@graph", [])
        if not isinstance(graph, list):
            continue

        for item in graph:
            if item.get("@type") != "BreadcrumbList":
                continue
            entries = item.get("ItemListElement", [])
            if not isinstance(entries, list):
                continue
            path = [normalize_whitespace(str(entry.get("Name", ""))) for entry in entries]
            return [part for part in path if part and part != "Product Index"]

    heading = selector.xpath('//h1/text()')
    if heading:
        return [normalize_whitespace(heading[0].text)]
    raise RuntimeError("Failed to parse DigiKey category path.")


def parse_parameter_fields(selector: Selector) -> List[ParameterField]:
    fields: List[ParameterField] = []
    seen: set[str] = set()
    ignored_labels = {
        "Mfr Part #",
        "Quantity Available",
        "Price",
        "Tariff Status",
        "Package",
    }

    for text_node in selector.xpath('//*[@data-testid="custom-header-label"]/text()'):
        label = normalize_whitespace(text_node.text or "")
        if not label or label in seen or label in ignored_labels:
            continue
        seen.add(label)
        fields.append(ParameterField(label=label, normalizedName=label))

    for box in selector.xpath('//*[@data-testid="filter-box-outer-ref"]'):
        previous_text_nodes = box.parent.xpath('./preceding-sibling::*[1]/text()')
        if not previous_text_nodes:
            continue
        label = normalize_whitespace(previous_text_nodes[0].text or "")
        if not label or label in seen or label in {"Stocking Options", "Environmental Options", "Media", "Exclude"}:
            continue
        seen.add(label)
        fields.append(ParameterField(label=label, normalizedName=label))

    if not fields:
        raise RuntimeError("Failed to parse DigiKey filter fields.")

    return fields


def load_fixture_html(fixtures_dir: Path, slug: str) -> str:
    fixture_path = fixtures_dir / slug_to_fixture_name(slug)
    if not fixture_path.exists():
        raise RuntimeError(f"Missing DigiKey fixture: {fixture_path}")
    return fixture_path.read_text(encoding="utf-8")


def save_fixture_html(fixtures_dir: Path, slug: str, html: str) -> None:
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    fixture_path = fixtures_dir / slug_to_fixture_name(slug)
    fixture_path.write_text(html, encoding="utf-8")


def build_taxonomy(html_by_slug: dict[str, str]) -> dict:
    categories: List[CategoryTemplate] = []

    for target in TARGET_CATEGORIES:
        html = html_by_slug[target["slug"]]
        selector = Selector(html, url=target["url"])
        categories.append(
            CategoryTemplate(
                slug=target["slug"],
                sourceUrl=target["url"],
                categoryPath=parse_category_path(selector),
                matchSignals=list(target["matchSignals"]),
                parameterFields=parse_parameter_fields(selector),
            )
        )

    return {
        "source": "digikey",
        "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "categories": [
            {
                **asdict(category),
                "parameterFields": [asdict(field) for field in category.parameterFields]
            }
            for category in categories
        ]
    }


def parse_args(argv: list[str]) -> tuple[Path | None, Path, bool, bool]:
    fixtures_dir: Path | None = None
    output_path = OUTPUT_PATH
    write_fixtures = False
    refresh_live = False

    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg == "--input-dir":
            if index + 1 >= len(argv):
                raise SystemExit("--input-dir requires a path")
            fixtures_dir = Path(argv[index + 1]).expanduser()
            index += 2
            continue
        if arg == "--output":
            if index + 1 >= len(argv):
                raise SystemExit("--output requires a path")
            output_path = Path(argv[index + 1]).expanduser()
            index += 2
            continue
        if arg == "--write-fixtures":
            write_fixtures = True
            index += 1
            continue
        if arg == "--refresh-live":
            refresh_live = True
            index += 1
            continue
        raise SystemExit(f"Unknown argument: {arg}")

    return fixtures_dir, output_path, write_fixtures, refresh_live


def main() -> None:
    fixtures_dir, output_path, write_fixtures, refresh_live = parse_args(sys.argv[1:])

    if fixtures_dir is not None:
        html_by_slug = {
            target["slug"]: load_fixture_html(fixtures_dir, target["slug"])
            for target in TARGET_CATEGORIES
        }
    else:
        # Default to checked-in fixtures so taxonomy generation stays reproducible
        # during normal development without requiring a fresh DigiKey clearance.
        if not refresh_live and FIXTURES_DIR.exists():
            html_by_slug = {
                target["slug"]: load_fixture_html(FIXTURES_DIR, target["slug"])
                for target in TARGET_CATEGORIES
            }
        else:
            cf_clearance = get_cf_clearance_from_env() or get_cf_clearance_from_playwright()
            html_by_slug = {}
            for target in TARGET_CATEGORIES:
                html = fetch_html(target["url"], cf_clearance)
                html_by_slug[target["slug"]] = html
                if write_fixtures:
                    save_fixture_html(FIXTURES_DIR, target["slug"], html)

    data = build_taxonomy(html_by_slug)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
