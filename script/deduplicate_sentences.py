"""Deduplicate numbered English/Chinese TSV rows, ignoring punctuation."""

import argparse
import unicodedata
from pathlib import Path


def english_key(sentence: str) -> str:
    # Unicode P* includes ASCII and full-width punctuation; retain apostrophe-free words.
    without_punctuation = "".join(
        " " if unicodedata.category(char).startswith("P") else char
        for char in sentence
    )
    return " ".join(without_punctuation.casefold().split())


def main() -> None:
    parser = argparse.ArgumentParser(description="Keep the first English sentence, ignoring punctuation, and renumber.")
    parser.add_argument("input", type=Path, help="Input TSV: number, English, Chinese")
    parser.add_argument("-o", "--output", type=Path, help="Output TSV (default: input name + _deduplicated.tsv)")
    args = parser.parse_args()
    source = args.input
    target = args.output or source.with_name(source.stem + "_deduplicated.tsv")
    if source.resolve() == target.resolve():
        parser.error("Output path must differ from input path")

    seen: set[str] = set()
    count = 0
    skipped = 0
    with source.open("r", encoding="utf-8-sig", newline="") as original, target.open(
        "w", encoding="utf-8", newline=""
    ) as result:
        for line_number, raw in enumerate(original, 1):
            line = raw.rstrip("\r\n")
            if not line.strip():
                continue
            columns = line.split("\t")
            if len(columns) != 3:
                raise ValueError(f"Line {line_number}: expected 3 tab-separated columns, got {len(columns)}")
            _, english, chinese = columns
            key = english_key(english)
            if not key:
                raise ValueError(f"Line {line_number}: English text is empty after removing punctuation")
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            count += 1
            result.write(f"{count:05d}\t{english}\t{chinese}\n")
    print(f"Saved {count} sentences; removed {skipped} duplicates: {target}")


if __name__ == "__main__":
    main()
