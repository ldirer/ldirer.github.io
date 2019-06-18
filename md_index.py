#!/home/laurent/miniconda3/envs/freelance-sourcing/bin/python
from collections import defaultdict

fname = '/home/laurent/recurse/deploy-app-docker/deploy_app_docker_production.md'

def title_to_link(title: str):
    chars_to_remove = '(),:'
    for c in chars_to_remove:
        title = title.replace(c, '')

    return '#' + title.strip('# ').replace(' ', '-').lower()


def read_headers(fname: str):
    """Read headers from a mardown file. We don't have to insert links to get anchor tags,
    there's a default string that works (with Jekyll output at least)."""
    in_code_block = False
    with open(fname, 'r') as f:
        # headers: ['# Title 1', '## Subtitle', '# Title 2'] 
        headers = []
        for line in f:
            if line.startswith('```'):
                in_code_block = not in_code_block
            if line.startswith('#') and not in_code_block:
                headers.append(line.strip())

    return headers


def get_index(headers):
    base_indent = ' ' * 4
    current_level = 1
    level_to_count = defaultdict(lambda: 1) 
    lines = []
    for h in headers:
        level = len(h) - len(h.strip('#'))
        # Mardown numbering requires an extra line
        if current_level != level:
            lines.append('')
        current_level = level

        indent = base_indent * (level - 1)
        link = title_to_link(h)
        number = level_to_count[level]
        # note we strip spaces from the heading.
        lines.append(f"{indent}{number}. [{h.strip(' #')}]({link})")
             
        level_to_count[level] += 1

    return '\n'.join(lines)


def test_title_to_link():
    title = 'Optimizations (leaner, faster or just better)'
    assert title_to_link(title) == '#optimizations-leaner-faster-or-just-better'
   

test_title_to_link()
print(get_index(read_headers(fname)))
