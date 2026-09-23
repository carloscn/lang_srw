#!/usr/bin/env python3
"""将 Tab 分隔的“序号、英文、中文”文件中的中文繁体转换为简体。"""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='UTF-8 编码的三列 TSV 文件')
    args = parser.parse_args()
    try:
        from opencc import OpenCC
    except ImportError:
        parser.exit(1, '请先安装依赖：python -m pip install opencc-python-reimplemented\n')
    converter = OpenCC('tw2s')
    source = args.input
    target = source.with_name(source.stem + '_simplified' + source.suffix)
    lines = []
    count = changed = 0
    try:
        # 保留每行原来的换行符、序号和英文，只转换第三列。
        with source.open('r', encoding='utf-8-sig', newline='') as stream:
            for number, line in enumerate(stream, 1):
                body = line.rstrip('\r\n')
                ending = line[len(body):]
                if not body.strip():
                    lines.append(line)
                    continue
                columns = body.split('\t')
                if len(columns) != 3 or not columns[0].isascii() or not columns[0].isdigit():
                    raise ValueError(f'第 {number} 行格式不符，应为：数字序号 + Tab + 英文 + Tab + 中文。')
                simplified = converter.convert(columns[2])
                changed += simplified != columns[2]
                columns[2] = simplified
                lines.append('\t'.join(columns) + ending)
                count += 1
        with target.open('x', encoding='utf-8-sig', newline='') as stream:
            stream.writelines(lines)
    except (OSError, UnicodeError, ValueError) as exc:
        parser.exit(1, f'处理失败：{exc}\n')
    print(f'完成：共 {count} 条，转换了 {changed} 条中文。\n输出：{target}')


if __name__ == '__main__':
    main()
