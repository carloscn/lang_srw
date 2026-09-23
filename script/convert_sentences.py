#!/usr/bin/env python3
"""将三列 TSV 转为：五位序号、英文、中文。原文件保持不变。"""
import argparse
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='UTF-8 编码、Tab 分隔的原始文件')
    args = parser.parse_args()
    source = args.input
    target = source.with_name(source.stem + '_numbered.tsv')
    records = []
    try:
        with source.open('r', encoding='utf-8-sig') as stream:
            for line_number, line in enumerate(stream, 1):
                line = line.rstrip('\r\n')
                if not line.strip():
                    continue
                columns = line.split('\t')
                if len(columns) != 3:
                    raise ValueError(f'原文件第 {line_number} 行不是三列，请检查 Tab 分隔符。')
                if len(records) >= 99999:
                    raise ValueError('记录超过 99999 条，无法使用固定五位序号。')
                records.append(f'{len(records) + 1:05d}\t{columns[0]}\t{columns[1]}\n')
        # x 模式：如果输出文件已存在则报错，避免覆盖。
        with target.open('x', encoding='utf-8-sig', newline='') as stream:
            stream.writelines(records)
    except (OSError, UnicodeError, ValueError) as exc:
        parser.exit(1, f'处理失败：{exc}\n')
    print(f'已输出 {len(records)} 条：{target}')


if __name__ == '__main__':
    main()
