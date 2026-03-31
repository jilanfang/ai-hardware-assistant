import csv
import json
import re
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from scrapling import Selector


ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
DEFAULT_OUTPUT_DIR = ROOT / "lib" / "generated"
CATEGORY_URL = (
    "https://www.mouser.com/c/semiconductors/integrated-circuits-ics/"
    "wireless-rf-integrated-circuits/rf-front-end/"
)


def parse_args(argv: list[str]) -> tuple[Path | None, Path, int | None, bool]:
    input_dir: Path | None = None
    output_dir = DEFAULT_OUTPUT_DIR
    limit: int | None = None
    resume = False

    index = 0
    while index < len(argv):
        arg = argv[index]
        if arg == "--input-dir":
            if index + 1 >= len(argv):
                raise SystemExit("--input-dir requires a path")
            input_dir = Path(argv[index + 1]).expanduser()
            index += 2
            continue
        if arg == "--output-dir":
            if index + 1 >= len(argv):
                raise SystemExit("--output-dir requires a path")
            output_dir = Path(argv[index + 1]).expanduser()
            index += 2
            continue
        if arg == "--limit":
            if index + 1 >= len(argv):
                raise SystemExit("--limit requires a number")
            limit = int(argv[index + 1])
            index += 2
            continue
        if arg == "--resume":
            resume = True
            index += 1
            continue
        raise SystemExit(f"Unknown argument: {arg}")

    return input_dir, output_dir, limit, resume


def load_fixture(path: Path) -> str:
    if not path.exists():
        raise RuntimeError(f"Missing fixture: {path}")
    return path.read_text(encoding="utf-8")


def normalize(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(value.split()).strip()


def extract_json_ld_objects(html: str) -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for match in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, flags=re.S):
        raw = unescape(match).strip()
        if not raw:
            continue
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, list):
            payloads.extend(item for item in parsed if isinstance(item, dict))
        elif isinstance(parsed, dict):
            payloads.append(parsed)
    return payloads


def extract_datalayer_product_event(html: str) -> dict[str, Any]:
    match = re.search(r'dataLayer\.push\((\{"event":"pageData".*?\})\);', html, flags=re.S)
    if not match:
        return {}
    try:
        payload = json.loads(match.group(1))
    except json.JSONDecodeError:
        return {}
    attributes = payload.get("attributes", {})
    return attributes if isinstance(attributes, dict) else {}


def parse_category_page(html: str) -> tuple[str, list[str], list[dict[str, Any]]]:
    selector = Selector(html, url=CATEGORY_URL)
    heading = normalize(selector.css("h1::text").get())
    category_name = heading or "RF Front End"

    category_path = [normalize(node.text) for node in selector.css('nav[aria-label="breadcrumb"] a')]
    category_path = [item for item in category_path if item]
    if category_name and (not category_path or category_path[-1] != category_name):
        category_path.append(category_name)

    products: list[dict[str, Any]] = []
    for row in selector.css("tr[data-index]"):
        detail_href = row.css('a[href*="/ProductDetail/"]::attr(href)').get()
        if not detail_href:
            continue
        detail_url = urljoin("https://www.mouser.com", detail_href.strip())
        listing_position = len(products) + 1

        manufacturer_part_number = normalize(
            row.css('tr::attr(data-mfrpartnumber), input[name*="MfrPartNumber"]::attr(value), .mfr-part-num a::text').get()
        )
        mouser_part_number = normalize(
            row.css('tr::attr(data-partnumber), input[name*="MouserPartNumber"]::attr(value), .mpart-number-lbl::text').get()
        )
        manufacturer = normalize(
            row.css(
                'tr::attr(data-actualmfrname), input[name*="ActualMfrName"]::attr(value), .mfr-column a::text, .mfr-name::text'
            ).get()
        )
        description = normalize(row.css(".desc-column span::text, .truncated-desc::text").get())
        datasheet_url = row.css('a[id^="lnkDataSheet_"]::attr(href)').get()
        stock_amount = normalize(row.css(".available-amount::text").get())
        stock_status = normalize(row.css(".avail-status::text").get())

        pricing = extract_pricing_from_row(row)

        product = {
            "detail_url": detail_url,
            "listing_position": listing_position,
            "manufacturer": manufacturer,
            "manufacturer_part_number": manufacturer_part_number,
            "mouser_part_number": mouser_part_number,
            "description": description,
            "datasheet_url": urljoin(detail_url, datasheet_url) if datasheet_url else None,
            "stock": normalize(f"{stock_amount} {stock_status}"),
            "pricing": pricing,
        }
        products.append(product)

    return category_name, category_path, products


def quantity_sort_key(quantity: str) -> int:
    digits = re.sub(r"[^\d]", "", quantity)
    return int(digits) if digits else sys.maxsize


def extract_pricing_from_row(row: Selector) -> str:
    price_by_quantity: dict[str, str] = {}
    for price_row in row.css("table.search-pricing-table tr[data-qty]"):
        qty = normalize(" ".join(price_row.css("th::text, th button::text").getall()))
        price = normalize(" ".join(price_row.css(".PriceBreakPrice span::text").getall()))
        if not qty or not price:
            continue
        price_by_quantity[qty] = price

    ordered_quantities = sorted(price_by_quantity.keys(), key=quantity_sort_key)
    return " | ".join(f"{qty}:{price_by_quantity[qty]}" for qty in ordered_quantities)


def detail_matches_product(detail_data: dict[str, Any], product_ref: dict[str, Any]) -> bool:
    ref_mpn = normalize(str(product_ref.get("manufacturer_part_number", ""))).lower()
    ref_mouser = normalize(str(product_ref.get("mouser_part_number", ""))).lower()
    detail_mpn = normalize(str(detail_data.get("manufacturer_part_number", ""))).lower()
    detail_mouser = normalize(str(detail_data.get("mouser_part_number", ""))).lower()
    return bool(ref_mpn and detail_mpn and ref_mpn == detail_mpn) or bool(ref_mouser and detail_mouser and ref_mouser == detail_mouser)


def parse_detail_page(html: str, detail_url: str) -> dict[str, Any]:
    selector = Selector(html, url=detail_url)
    page_title = normalize(selector.css("title::text").get())

    manufacturer = ""
    manufacturer_part_number = ""
    mouser_part_number = ""
    datasheet_url = None
    description = ""
    image_url = None
    stock = ""
    pricing = ""
    product_attributes: dict[str, str] = {}
    data_layer = extract_datalayer_product_event(html)

    for payload in extract_json_ld_objects(html):
        if payload.get("@type") == "Product":
            if isinstance(payload.get("manufacturer"), dict):
                manufacturer = normalize((payload.get("manufacturer") or {}).get("name")) or manufacturer
            manufacturer = normalize(payload.get("brand")) or manufacturer
            manufacturer_part_number = normalize(payload.get("mpn")) or manufacturer_part_number
            mouser_part_number = normalize(payload.get("sku")) or mouser_part_number
            description = normalize(payload.get("description")) or description
            image_value = payload.get("image")
            if isinstance(image_value, str) and image_value:
                image_url = image_value

    if not manufacturer:
        manufacturer = normalize(data_layer.get("event_brand")) or manufacturer
    if not manufacturer_part_number:
        manufacturer_part_number = normalize(data_layer.get("event_manufacturerpn")) or manufacturer_part_number
    if not mouser_part_number:
        mouser_part_number = normalize(data_layer.get("event_mouserpn")) or mouser_part_number
    datasheet_url = normalize(data_layer.get("event_datasheet_url")) or datasheet_url
    if data_layer.get("event_image_url") and not image_url:
        image_url = urljoin("https://www.mouser.com/images/", str(data_layer["event_image_url"]))
    stock = normalize(data_layer.get("event_stock_status")) or stock

    label_nodes = selector.css("span, div, th, td")
    for node in label_nodes:
        text = normalize(node.text)
        if text.startswith("Mouser #:"):
            mouser_part_number = normalize(text.split("Mouser #:", 1)[1]) or mouser_part_number
        elif text.startswith("Mfr. #:"):
            manufacturer_part_number = normalize(text.split("Mfr. #:", 1)[1]) or manufacturer_part_number
        elif text.startswith("Mfr.:"):
            manufacturer = normalize(text.split("Mfr.:", 1)[1]) or manufacturer
        elif text.startswith("Description:"):
            description = normalize(text.split("Description:", 1)[1]) or description
        elif text.startswith("Availability:"):
            stock = normalize(text.split("Availability:", 1)[1]) or stock

    datasheet_link = selector.css('a[href*="Datasheet"], a[title*="Datasheet"]::attr(href)').get()
    if datasheet_link:
        datasheet_url = urljoin(detail_url, datasheet_link)
    else:
        href = selector.css('a::attr(href)').getall()
        for item in href:
            if "datasheet" in item.lower():
                datasheet_url = urljoin(detail_url, item)
                break

    image_src = selector.css('img[alt*="product"]::attr(src), img[src*="/images/"]::attr(src)').get()
    if image_src:
        image_url = urljoin(detail_url, image_src)

    text_content = normalize(selector.text)
    if not stock:
        stock_match = re.search(r"In Stock:\s*([^\n]+)", text_content)
        if stock_match:
            stock = normalize(stock_match.group(1))
    pricing_match = re.search(r"Pricing:\s*([^\n]+)", text_content)
    if pricing_match:
        pricing = normalize(pricing_match.group(1))

    for row in selector.css("tr"):
        cells = row.css("th, td")
        if len(cells) < 2:
            continue
        key = normalize(cells[0].text)
        value = normalize(cells[1].text)
        if not key or not value:
            continue
        if key in {"Mouser #", "Mfr. #", "Mfr.", "Description", "Availability", "Pricing"}:
            continue
        product_attributes[key] = value

    return {
        "detail_url": detail_url,
        "title": page_title,
        "manufacturer": manufacturer,
        "manufacturer_part_number": manufacturer_part_number,
        "mouser_part_number": mouser_part_number,
        "description": description,
        "datasheet_url": datasheet_url,
        "image_url": image_url,
        "stock": stock,
        "pricing": pricing,
        "product_attributes": product_attributes,
    }


def load_progress(progress_path: Path) -> set[str]:
    if not progress_path.exists():
        return set()
    try:
        payload = json.loads(progress_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return set()
    completed = payload.get("completedDetailUrls", [])
    if not isinstance(completed, list):
        return set()
    return {str(item) for item in completed}


def write_progress(progress_path: Path, completed_urls: list[str]) -> None:
    progress_payload = {
        "categoryUrl": CATEGORY_URL,
        "completedDetailUrls": completed_urls,
        "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    progress_path.write_text(json.dumps(progress_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def stringify_attributes(attributes: dict[str, str]) -> str:
    return json.dumps(attributes, ensure_ascii=False, sort_keys=True)


def stringify_category_path(category_path: Any) -> str:
    if isinstance(category_path, list):
        return " > ".join(normalize(str(item)) for item in category_path if normalize(str(item)))
    return normalize(str(category_path))


def write_csv(csv_path: Path, products: list[dict[str, Any]]) -> None:
    fieldnames = [
        "detail_url",
        "manufacturer",
        "manufacturer_part_number",
        "mouser_part_number",
        "title",
        "description",
        "datasheet_url",
        "image_url",
        "stock",
        "pricing",
        "category_name",
        "category_path",
        "listing_position",
        "scraped_at",
        "product_attributes",
    ]
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for product in products:
            writer.writerow(
                {
                    **{key: product.get(key, "") for key in fieldnames if key != "product_attributes"},
                    "category_path": stringify_category_path(product.get("category_path", "")),
                    "product_attributes": stringify_attributes(product.get("product_attributes", {})),
                }
            )


def main() -> None:
    input_dir, output_dir, limit, resume = parse_args(sys.argv[1:])
    fixtures_dir = input_dir or FIXTURES_DIR

    category_html = load_fixture(fixtures_dir / "rf-front-end-category.html")
    detail_html = load_fixture(fixtures_dir / "rfx2401c-detail.html")

    category_name, category_path, product_refs = parse_category_page(category_html)

    output_dir.mkdir(parents=True, exist_ok=True)
    json_path = output_dir / "mouser-rf-front-end-products.json"
    csv_path = output_dir / "mouser-rf-front-end-products.csv"
    progress_path = output_dir / "mouser-rf-front-end-progress.json"

    completed_urls = load_progress(progress_path) if resume else set()

    products: list[dict[str, Any]] = []
    for ref in product_refs:
        detail_url = ref["detail_url"]
        if detail_url in completed_urls:
            continue

        product = dict(ref)
        detail_data = parse_detail_page(detail_html, detail_url)
        if detail_matches_product(detail_data, ref):
            for key, value in detail_data.items():
                if key == "product_attributes":
                    product[key] = value
                    continue
                if key == "manufacturer" and value:
                    existing_manufacturer = normalize(str(product.get("manufacturer", "")))
                    incoming_manufacturer = normalize(str(value))
                    if len(incoming_manufacturer) > len(existing_manufacturer):
                        product[key] = incoming_manufacturer
                    continue
                existing = product.get(key)
                if existing:
                    continue
                if value:
                    product[key] = value
        else:
            product.setdefault("title", "")
            product.setdefault("image_url", None)
            product.setdefault("product_attributes", {})

        product["category_name"] = category_name
        product["category_url"] = CATEGORY_URL
        product["category_path"] = category_path
        product["scraped_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        products.append(product)
        completed_urls.add(detail_url)

        if limit is not None and len(products) >= limit:
            break

    payload = {
        "source": "mouser",
        "categoryName": category_name,
        "categoryUrl": CATEGORY_URL,
        "categoryPath": category_path,
        "scrapedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "products": products,
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_csv(csv_path, products)
    write_progress(progress_path, sorted(completed_urls))

    print(f"Wrote {json_path}")
    print(f"Wrote {csv_path}")
    print(f"Wrote {progress_path}")


if __name__ == "__main__":
    main()
