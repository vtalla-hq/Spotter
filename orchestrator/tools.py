"""Tool registry: every tool declares a typed (Pydantic) input schema and a risk level.

The schema is what the model sees and what its arguments are validated against before
anything runs. High-risk tools pause the graph for a human decision (see graph.py).
"""

import ipaddress
import os
import socket
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Callable
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from . import db


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    schema: type[BaseModel]
    fn: Callable[[BaseModel], str]
    high_risk: bool = False

    def json_schema(self) -> dict:
        return self.schema.model_json_schema()


TOOLS: dict[str, Tool] = {}


def tool(name: str, description: str, schema: type[BaseModel], high_risk: bool = False):
    def register(fn):
        TOOLS[name] = Tool(name, description, schema, fn, high_risk)
        return fn

    return register


# ---------- PubMed (NCBI E-utilities), same source as Spotter's Ask tab ----------

EU = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"


def _eutils(path: str, **params) -> httpx.Response:
    params = {"db": "pubmed", "tool": "spotter", **params}
    if key := os.getenv("NCBI_API_KEY"):
        params["api_key"] = key
    r = httpx.get(EU + path, params=params, timeout=20)
    r.raise_for_status()
    return r


class SearchPubmed(BaseModel):
    query: str = Field(max_length=300, description="PubMed query, e.g. 'creatine creatinine kidney meta-analysis'")
    max_results: int = Field(default=8, ge=1, le=12)


@tool("search_pubmed", "Search PubMed. Returns PMID, year, journal, publication type and title per hit.", SearchPubmed)
def search_pubmed(a: SearchPubmed) -> str:
    ids = _eutils("esearch.fcgi", term=a.query, retmax=a.max_results, sort="relevance", retmode="json").json()
    ids = ids.get("esearchresult", {}).get("idlist", [])
    if not ids:
        return "No results. Try broader or different terms."
    res = _eutils("esummary.fcgi", id=",".join(ids), retmode="json").json().get("result", {})
    lines = []
    for i in ids:
        x = res.get(i, {})
        types = [t for t in x.get("pubtype", []) if t != "Journal Article"]
        lines.append(f"PMID {i} | {str(x.get('pubdate', '?'))[:4]} | {x.get('source', '')} | {', '.join(types) or 'Article'} | {x.get('title', '')}")
    return "\n".join(lines)


class ReadAbstracts(BaseModel):
    pmids: list[str] = Field(min_length=1, max_length=3, description="Up to 3 PMIDs")


def parse_articles(xml: str) -> list[dict]:
    out = []
    for art in ET.fromstring(xml).iter("PubmedArticle"):
        text = lambda path: "".join(art.find(path).itertext()).strip() if art.find(path) is not None else ""  # noqa: E731
        parts = []
        for t in art.iter("AbstractText"):
            body = "".join(t.itertext()).strip()
            parts.append(f"{t.get('Label')}: {body}" if t.get("Label") else body)
        out.append(
            {
                "pmid": text(".//PMID"),
                "title": text(".//ArticleTitle"),
                "journal": text(".//ISOAbbreviation") or text(".//Journal/Title"),
                "year": (text(".//PubDate/Year") or text(".//PubDate/MedlineDate"))[:4] or None,
                "abstract": " ".join(parts) or "(no abstract)",
            }
        )
    return out


@tool("read_abstracts", "Read the abstracts of up to 3 PubMed articles by PMID.", ReadAbstracts)
def read_abstracts(a: ReadAbstracts) -> str:
    ids = [p for p in ("".join(c for c in x if c.isdigit()) for x in a.pmids) if p]
    if not ids:
        return "No valid PMIDs."
    arts = parse_articles(_eutils("efetch.fcgi", id=",".join(ids), rettype="abstract", retmode="xml").text)
    return "\n\n---\n\n".join(f"PMID {x['pmid']} ({x['year']}, {x['journal']})\n{x['title']}\n{x['abstract'][:1500]}" for x in arts) or "Couldn't fetch those PMIDs."


# ---------- Web pages via Scrapling ----------


def public_url(url: str) -> bool:
    """Only http(s) to hosts that resolve to public addresses (no SSRF into the cluster)."""
    u = urlparse(url)
    if u.scheme not in ("http", "https") or not u.hostname:
        return False
    try:
        addrs = {ai[4][0] for ai in socket.getaddrinfo(u.hostname, None)}
    except socket.gaierror:
        return False
    return all(ipaddress.ip_address(a.split("%")[0]).is_global for a in addrs)


class FetchPage(BaseModel):
    url: str = Field(max_length=2000, description="Public http(s) URL, e.g. a guideline or regulator page")
    find: str | None = Field(default=None, max_length=100, description="Optional keyword: return only passages around it")
    start: int = Field(default=0, ge=0, description="Character offset to continue reading from, as given by the previous call")


def passages(text: str, find: str | None, start: int = 0, limit: int = 3000, radius: int = 600) -> str:
    """`limit` chars from `start`, of the page or, with `find`, of the windows around each
    case-insensitive match, densest first (a topic's own section beats its mentions in menus)."""
    if find:
        text = _windows(text, find, radius)
        if not text:
            return f"'{find}' not found on the page."
    end = min(start + limit, len(text))
    more = f"\n[chars {start}-{end} of {len(text)}; call again with start={end} for more]" if end < len(text) else ""
    return text[start:end] + more


def _windows(text: str, find: str, radius: int) -> str:
    low, key, spans = text.lower(), find.lower(), []
    i = low.find(key)
    while i != -1:
        a, b = max(0, i - radius), i + len(key) + radius
        if spans and a <= spans[-1][1]:
            spans[-1][1] = b
        else:
            spans.append([a, b])
        i = low.find(key, b - radius)
    spans.sort(key=lambda s: low.count(key, s[0], s[1]), reverse=True)
    return " … ".join(text[a:b] for a, b in spans)


@tool("fetch_page", "Fetch a public web page and return its visible text (3000 chars at a time; `find` jumps to the passages that mention it most).", FetchPage)
def fetch_page(a: FetchPage) -> str:
    if not public_url(a.url):
        return "Refused: only public http(s) URLs."
    from scrapling.fetchers import Fetcher  # heavy import, only when used

    # Scrapling's default follow_redirects="safe" refuses redirects to private IPs
    page = Fetcher.get(a.url, timeout=20)
    if page.status >= 400:
        return f"HTTP {page.status}"
    return passages(" ".join(str(page.get_all_text(ignore_tags=("script", "style", "nav", "footer"))).split()), a.find, a.start)


# ---------- High risk: writes to the shared study library ----------


class SaveStudies(BaseModel):
    pmids: list[str] = Field(min_length=1, max_length=10)
    note: str = Field(max_length=500, description="Why these studies matter, shown to everyone")


@tool(
    "save_to_library",
    "Add studies to Spotter's shared study library, visible to every user. Needs human approval.",
    SaveStudies,
    high_risk=True,
)
def save_to_library(a: SaveStudies) -> str:
    n = db.save_studies(a.pmids, a.note)
    return f"Saved {n} studies to the library."
