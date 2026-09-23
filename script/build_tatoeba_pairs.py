#!/usr/bin/env python3
"""用 Tatoeba 每周导出文件生成双语句库：序号、原文、译文（Tab 分隔）。

需要三个文件（https://downloads.tatoeba.org/exports/per_language/ 下载后解压）：
  <src>/<src>_sentences.tsv       例如 spa/spa_sentences.tsv
  <tgt>/<tgt>_sentences.tsv       例如 cmn/cmn_sentences.tsv
  <src>/<src>-<tgt>_links.tsv     例如 spa/spa-cmn_links.tsv

同一原文有多个译文时合并为「译文1 / 译文2」。译文是中文时可加 --simplified，
用 OpenCC 繁转简（需要 python -m pip install opencc-python-reimplemented）。

示例：
  python script/build_tatoeba_pairs.py spa_sentences.tsv cmn_sentences.tsv spa-cmn_links.tsv \\
      data/libraries/spanish-chinese/sentences.tsv --simplified
"""
import argparse
from pathlib import Path


def read_sentences(path):
    sentences = {}
    with path.open('r', encoding='utf-8') as stream:
        for line in stream:
            columns = line.rstrip('\r\n').split('\t')
            if len(columns) >= 3 and columns[2].strip():
                sentences[columns[0]] = columns[2].strip()
    return sentences


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source_sentences', type=Path)
    parser.add_argument('target_sentences', type=Path)
    parser.add_argument('links', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--simplified', action='store_true', help='译文繁体转简体')
    args = parser.parse_args()

    convert = lambda text: text
    if args.simplified:
        try:
            from opencc import OpenCC
        except ImportError:
            parser.exit(1, '请先安装依赖：python -m pip install opencc-python-reimplemented\n')
        # t2s, not tw2s: tw2s turns an already-simplified 么 (什么) into 幺.
        convert = OpenCC('t2s').convert

    source = read_sentences(args.source_sentences)
    target = read_sentences(args.target_sentences)

    # 原文句子编号 -> 译文列表；再按原文文本合并（Tatoeba 偶有重复句子）。
    pairs = {}
    with args.links.open('r', encoding='utf-8') as stream:
        for line in stream:
            columns = line.rstrip('\r\n').split('\t')
            if len(columns) < 2 or columns[0] not in source or columns[1] not in target:
                continue
            pairs.setdefault(columns[0], []).append(convert(target[columns[1]]))

    by_text = {}
    for source_id in sorted(pairs, key=int):
        translations = by_text.setdefault(source[source_id], [])
        for translation in pairs[source_id]:
            if translation not in translations:
                translations.append(translation)

    if len(by_text) > 99999:
        parser.exit(1, '句子超过 99999 条，无法使用五位序号。\n')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('w', encoding='utf-8', newline='\n') as stream:
        for number, (text, translations) in enumerate(by_text.items(), 1):
            stream.write(f'{number:05d}\t{text}\t{" / ".join(translations)}\n')
    print(f'完成：{len(by_text)} 句（来自 {sum(len(v) for v in pairs.values())} 条对应关系）。输出：{args.output}')


if __name__ == '__main__':
    main()
