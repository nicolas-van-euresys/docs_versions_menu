"""Sphinx extension for showing the Doctr Versions Menu."""

import os
from pathlib import Path

from sphinx.util.template import SphinxRenderer


def add_versions_menu_js_file(app):
    """Add docs-versions-menu.js as a static file, on every page."""
    app.config.html_static_path.append(str(Path(__file__).parent / '_js'))
    app.add_js_file('docs-versions-menu.js')

    template_path = [
        os.path.join(app.confdir, folder)
        for folder in app.config.templates_path
    ]
    template_path.append(str(Path(__file__).parent / '_template'))
    renderer = SphinxRenderer(template_path=template_path)
    context = dict(
        github_project_url=None,
        badge_only=(app.config.html_theme != 'sphinx_rtd_theme'),
        menu_title="Docs",
    )
    if app.config.doctr_versions_menu_conf:
        print(
            "WARNING: using legacy options from "
            "`doctr_versions_menu_conf`. This option should be "
            "renamed to `docs_versions_menu_conf`"
        )
        context.update(app.config.doctr_versions_menu_conf)
    context.update(app.config.docs_versions_menu_conf)
    template_name = 'docs-versions-menu-launch.js_t'
    template = renderer.env.get_template(template_name)
    print(
        "injecting configuration from template %s for docs-versions-menu"
        % template.filename
    )
    app.add_js_file(None, body=template.render(**context))

    if context['badge_only']:
        app.config.html_static_path.extend(
            [
                str(Path(__file__).parent / '_css'),
                str(Path(__file__).parent / '_fonts'),
            ]
        )
        app.add_css_file('badge_only.css')
