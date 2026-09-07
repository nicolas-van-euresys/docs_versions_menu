"""Test for the docs_versions_menu Sphinx extension."""

from pathlib import Path

import pytest


@pytest.fixture
def rootdir():
    """The directory in which to search for testroots.

    This is used by any test using the pytest.mark.sphinx decorator. For a
    `testroot` specified in the decorator, the rootdir will be
    "./test_extension/roots/test-<testroot>".

    The rootdir must contain a conf.py file. All of the rootdir's content will
    be copied to a temporary folder, and the Sphinx builder will be invoked
    inside that folder.
    """
    return Path(__file__).with_suffix('') / 'roots'


@pytest.mark.sphinx('html', testroot='basic')
def test_basic(app, status, warning):
    """Test building documentation with the docs_versions_menu extension.

    This tests the default configuration in ./test_extension/roots/test-basic/
    """
    app.build()
    _build = Path(app.outdir)
    assert (_build / 'index.html').is_file()
    assert (_build / '_static' / 'docs-versions-menu.js').is_file()
    assert (_build / '_static' / 'badge_only.css').is_file()
    html = (_build / 'index.html').read_text()
    assert 'src="_static/docs-versions-menu.js' in html


@pytest.mark.sphinx('html', testroot='rtdtheme')
def test_rtdtheme(app, status, warning):
    """Test building documentation with the docs_versions_menu extension.

    This tests a configuration using the RTD theme, in
    ./test_extension/roots/test-rtdtheme/
    """
    app.build()
    _build = Path(app.outdir)
    assert (_build / 'index.html').is_file()
    assert (_build / '_static' / 'docs-versions-menu.js').is_file()
    assert not (_build / '_static' / 'badge_only.css').is_file()
    html = (_build / 'index.html').read_text()
    assert 'src="_static/docs-versions-menu.js' in html
    js = (_build / '_static' / 'docs-versions-menu.js').read_text()
    assert "<span class='fa fa-book'> Docs </span>" in js


@pytest.mark.sphinx('html', testroot='custom')
def test_custom(app, status, warning):
    """Test building documentation with the docs_versions_menu extension.

    This tests a configuration with full customization (custom template for the
    JS file, and a custom docs_versions_menu_conf dict in conf.py;
    ./test_extension/roots/test-custom/
    """
    app.build()
    _build = Path(app.outdir)
    assert (_build / 'index.html').is_file()
    assert (_build / '_static' / 'docs-versions-menu.js').is_file()
    assert not (_build / '_static' / 'badge_only.css').is_file()
    html = (_build / 'index.html').read_text()
    assert 'src="_static/docs-versions-menu.js' in html
    js = (_build / '_static' / 'docs-versions-menu.js').read_text()
    assert "var my_var = 'custom variable';" in js
    assert (
        "var github_project_url = 'https://github.com/goerz/docs_versions_menu';"
        in js
    )
    assert "var menu_title = 'Docs'" in js


@pytest.mark.sphinx('html', testroot='translations')
def test_multi_languages(app, status, warning):
    """Test building documentation with translations URL scheme.

    The url_version_scheme configuration selects, at template-generation
    time, which flavor of the JavaScript gets rendered: it is not passed
    through as a JavaScript variable. The default_language is not part of
    the extension configuration either: it is read from versions.json at
    runtime.
    """
    app.build()
    _build = Path(app.outdir)
    assert (_build / 'index.html').is_file()
    assert (_build / '_static' / 'docs-versions-menu.js').is_file()
    js = (_build / '_static' / 'docs-versions-menu.js').read_text()
    # Check that the language switcher code is present
    assert 'findFallbackLanguage' in js
    assert 'getCurrentLanguage' in js
    assert 'Translations' in js


@pytest.mark.sphinx('html', testroot='basic')
def test_no_translations_js_is_unaffected(app, status, warning):
    """Test that no-translations mode leaves the JS output untouched.

    The translations-only code (language switching, per-language index
    pages) must be compiled out of the JavaScript entirely when the
    "translations" URL scheme is not in use, so that the no-translations
    behavior and output stay identical to before that feature existed.
    """
    app.build()
    _build = Path(app.outdir)
    js = (_build / '_static' / 'docs-versions-menu.js').read_text()
    assert 'findFallbackLanguage' not in js
    assert 'getCurrentLanguage' not in js
    assert 'buildUrl' not in js
    assert 'Translations' not in js
