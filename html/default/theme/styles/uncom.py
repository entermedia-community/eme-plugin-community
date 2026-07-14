#!/usr/bin/env python3

import cssutils
import sys

cssutils.log.setLevel("FATAL")  # Silence parser warnings


def normalize_style(style):
    props = []
    for prop in style:
        props.append((prop.name.strip().lower(), prop.value.strip()))
    return tuple(sorted(props))


def extract_rules(path):
    sheet = cssutils.parseFile(path)

    rules = {}

    for rule in sheet:
        if rule.type == rule.STYLE_RULE:
            selector = ", ".join(
                s.strip() for s in rule.selectorText.split(",")
            )
            rules[(selector, normalize_style(rule.style))] = rule.cssText

    return rules


def main(a_file, b_file, output):
    a_rules = extract_rules(a_file)
    b_rules = extract_rules(b_file)

    uncommon = [
        css for key, css in a_rules.items()
        if key not in b_rules
    ]

    with open(output, "w", encoding="utf-8") as f:
        f.write("\n\n".join(uncommon))

    print(f"Extracted {len(uncommon)} unique rules to {output}")


if __name__ == "__main__":
    main("./theme.community.css", "./theme.css", "./uncommon.css")