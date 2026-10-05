"use strict";

(function(root) {

  var docsVersionMenu = {};

  /**
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  docsVersionMenu._urlExists = async function (url) {
    try {
      const r = await fetch(url, {method: "HEAD"});
      if (r.status === 405 || r.status === 501) {
        const r2 = await fetch(url);
        return r2.ok;
      }
      return r.ok;
    } catch {
      return false;
    }
  }

  /**
   * Gets the root URL, which means the URL directly containing the versions.json file.
   *
   * Throws an Error if no versions.json can be found.
   * @returns The root URL.
   */
  docsVersionMenu.getRootUrl = async function () {
    // Walk up the URL path until we find a versions.json, works on any host.
    const loc = new URL(window.location.href);
    let path = loc.pathname.replace(/\/[^/]*$/, '');
    while (true) {
      if (await docsVersionMenu._urlExists(loc.origin + path + "/versions.json")) {
        return loc.origin + path;
      }
      if (!path) throw new Error("docs-versions-menu: could not find versions.json");
      path = path.replace(/\/[^/]*$/, '');
    }
  }

  /**
   * @typedef {{
   *   downloads: Object<string, Array<[string, string]>>,
   *   folders: string[],
   *   labels: Object<string, string>,
   *   latest: (string|null),
   *   versions: string[],
   *   warnings: Object<string, string[]>,
   *   "default-branch": string,
   *   "url-version-scheme": (string|undefined),
   *   "default-language": (string|undefined),
   *   "available-languages": (Object<string, string[]>|undefined),
   * }} VersionData
   */

  /**
   * Loads the versions.json file and returns its content. Automatically calls getRootUrl.
   * @param {string?} rootUrl The root url. If not specified `getRootUrl()` will be called to acquire it.
   * @returns {Promise<VersionData>} The versions.json file content.
   */
  docsVersionMenu.loadVersionData = async function(rootUrl) {
    if (!rootUrl)
    {
      rootUrl = await docsVersionMenu.getRootUrl();
    }
    const json_file = rootUrl + "/versions.json";
    const response = await fetch(json_file);
    if (!response.ok)
      throw new Error(response.status + ' ' + response.statusText);
    const version_data = await response.json();
    return version_data;
  }

  /**
   * Splits the URL path after the root URL into individual segments.
   * @param {string} rootUrl The root url.
   * @returns {string[]} The path segments.
   */
  docsVersionMenu._pathParts = function (rootUrl) {
    return window.location.href.substring(rootUrl.length + 1).split("/");
  }

  /**
   * Returns the current version folder.
   *
   * For "no-translations" URL scheme (the default), the folder is the first
   * path segment after the root URL. For "translations" scheme, it is the
   * second segment (the first being the language code).
   * @param {string} rootUrl The root url.
   * @param {string} [urlVersionScheme="no-translations"] The URL scheme in use.
   * @returns The current version folder.
   */
  docsVersionMenu.getCurrentVersionFolder = function (rootUrl, urlVersionScheme) {
    if (urlVersionScheme === 'translations') {
      return docsVersionMenu._pathParts(rootUrl)[1];
    }
    return docsVersionMenu._pathParts(rootUrl)[0];
  }

  /**
   * Builds a URL for the given version (and optional language and path).
   * @param {string} urlVersionScheme "no-translations" or "translations"
   * @param {string} rootUrl The root url.
   * @param {string} version The version folder.
   * @param {string} path The remainder of the path (may be empty).
   * @param {string?} lang The language code (only used in "translations" scheme).
   * @returns {string} The constructed URL.
   */
  docsVersionMenu._buildUrl = function (urlVersionScheme, rootUrl, version, path, lang) {
    if (urlVersionScheme === 'translations') {
      return rootUrl + '/' + lang + '/' + version + (path ? '/' + path : '');
    }
    return rootUrl + '/' + version + (path ? '/' + path : '');
  }

  /**
   * Returns the current language code from the URL path.
   * Only meaningful when using the "translations" URL scheme.
   * @param {string} rootUrl The root url.
   * @returns {string} The current language code.
   */
  docsVersionMenu._getCurrentLanguage = function (rootUrl) {
    return docsVersionMenu._pathParts(rootUrl)[0];
  }

  /**
   * Finds the best available language for a given version.
   *
   * Returns `preferred` if it is in the list for `version`; otherwise
   * falls back to the first available language, or `defaultLanguage`.
   * @param {Object<string, string[]>} availableLanguages Map from version to list of language codes.
   * @param {string} version The version folder.
   * @param {string} preferred The preferred language code.
   * @param {string} defaultLanguage The fallback language code.
   * @returns {string} The best available language code.
   */
  docsVersionMenu._findFallbackLanguage = function (availableLanguages, version, preferred, defaultLanguage) {
    const langs = availableLanguages[version];
    if (langs && langs.indexOf(preferred) >= 0) return preferred;
    return (langs && langs[0]) || defaultLanguage;
  }

  /**
   * Returns the URL corresponding to the Github project if the current page uses a github.io URL.
   *
   * Returns null in all other cases.
   * @param {string} rootUrl The root url.
   * @returns The URL corresponding to the Github project or null.
   */
  docsVersionMenu._getGithubProjectUrl = function (rootUrl) {
    const match = rootUrl.match(/([\w\d-]+)\.github\.io\/([\w\d-]+)/);
    if (match !== null) {
      return "https://github.com/" + match[1] + "/" + match[2];
    }
    return null;
  }

  /**
   * @typedef {Object<string, Object<string, string>>} ProjectLinks
   */

  /**
   * Builds the link sections (beyond "Versions" and "Downloads") to render
   * in the menu: the sections from `options.projectLinks`, if any, followed
   * by an "On GitHub" section if a Github project URL is available.
   *
   * The Github project URL is `options.githubProjectUrl` if explicitly set;
   * otherwise, unless `options.projectLinks` is also set, it is
   * auto-detected from `rootUrl` (see `_getGithubProjectUrl`).
   * @param {Required<MenuOptions>} options
   * @param {string} rootUrl
   * @returns {Array<[string, Array<[string, string]>]>}
   */
  docsVersionMenu._buildProjectLinksSections = function (options, rootUrl) {
    const sections = [];
    if (options.projectLinks) {
      for (const [heading, links] of Object.entries(options.projectLinks)) {
        sections.push([heading, Object.entries(links)]);
      }
    }
    let github_project_url = options.githubProjectUrl;
    if (github_project_url == null && options.projectLinks == null) {
      github_project_url = docsVersionMenu._getGithubProjectUrl(rootUrl);
    }
    if (github_project_url !== null && github_project_url.length > 0) {
      sections.push([
        'On GitHub',
        [
          ['Project Home', github_project_url],
          ['Issues', github_project_url + '/issues'],
        ],
      ]);
    }
    return sections;
  }

  /**
   * @param {VersionData} version_data
   * @param {string} rootUrl
   * @param {Required<MenuOptions>} options
   * @returns {void}
   */
  docsVersionMenu._addVersionsMenu = function (version_data, rootUrl, options) {
    // The menu was reverse-engineered from the RTD websites, so it's very
    // specific to the sphinx_rtd_theme
    const url_version_scheme = version_data["url-version-scheme"] || "no-translations";
    const folders = version_data["versions"];
    const current_url = document.URL;
    const current_folder = docsVersionMenu.getCurrentVersionFolder(rootUrl, url_version_scheme);
    if (!current_folder || !(current_folder in version_data["labels"])) return;
    const current_version = version_data["labels"][current_folder];
    const path_parts = docsVersionMenu._pathParts(rootUrl);
    const current_path = path_parts.slice(url_version_scheme === "translations" ? 2 : 1).join("/");
    const current_language = url_version_scheme === "translations"
      ? docsVersionMenu._getCurrentLanguage(rootUrl)
      : null;
    const default_language = url_version_scheme === "translations"
      ? (version_data["default-language"] || 'en')
      : null;
    const available_languages = url_version_scheme === "translations"
      ? (version_data["available-languages"] || {})
      : null;
    const current_langs = url_version_scheme === "translations"
      ? (available_languages[current_folder] || [])
      : null;
    const menu = document.createElement('div');
    if (options.badgeOnly) {
      menu.setAttribute('class', 'rst-versions rst-badge');
    } else {
      menu.setAttribute('class', 'rst-versions');
    }
    menu.setAttribute('data-toggle', 'rst-versions');
    menu.setAttribute('role', 'note');
    menu.setAttribute('aria-label', 'versions');
    menu.style.overflowY = 'auto';
    let inner_html =
      "<span class='rst-current-version' data-toggle='rst-current-version'>" +
        "<span class='fa fa-book'> " + (!options.badgeOnly ? options.menuTitle : "") + " </span>" +
        "<span>" + current_version + " </span>" +
        "<span class='fa fa-caret-down'></span>" +
      "</span>" +
      "<div class='rst-other-versions'>" +
        "<div class='injected'>" +
          "<dl>" +
            "<dt>Versions</dt>";
    for (const folder of folders) {
      if (folder === current_folder) {
        inner_html += "<strong><dd><a href='"
                        + current_url
                        + "'>" + current_version + "</a></dd></strong>";
      } else {
        if (url_version_scheme === 'translations') {
          const targetLang = docsVersionMenu._findFallbackLanguage(
            available_languages, folder, current_language, default_language
          );
          inner_html += "<dd><a href='"
                          + docsVersionMenu._buildUrl(url_version_scheme, rootUrl, folder, current_path, targetLang)
                          + "'>" + version_data["labels"][folder] + "</a></dd>";
        } else {
          inner_html += "<dd><a href='"
                          + docsVersionMenu._buildUrl(url_version_scheme, rootUrl, folder, current_path)
                          + "'>" + version_data["labels"][folder] + "</a></dd>";
        }
      }
    }
    if (url_version_scheme === 'translations') {
      inner_html += "<dt>Translations</dt>";
      for (const lang of current_langs) {
        if (lang === current_language) {
          inner_html += "<strong><dd><a href='"
                          + current_url
                          + "'>" + lang + "</a></dd></strong>";
        } else {
          inner_html += "<dd><a href='"
                          + docsVersionMenu._buildUrl(url_version_scheme, rootUrl, current_folder, current_path, lang)
                          + "'>" + lang + "</a></dd>";
        }
      }
    }
    const downloads = version_data["downloads"][current_folder];
    if (downloads.length > 0) {
      inner_html +=
            "<dt>Downloads</dt>";
      for (const download of downloads) {
        const download_label = download[0];
        let download_url = download[1];
        if (!(/^(https?|ftp):/.test(download_url))) {
          if (!download_url.startsWith('/')) {
            download_url = '/' + download_url;
          }
          download_url = rootUrl + download_url;
        }
        inner_html += "<dd><a href='" + download_url + "'>"
                      + download_label + "</a></dd>";
      }
    }
    for (const [heading, links] of docsVersionMenu._buildProjectLinksSections(options, rootUrl)) {
      inner_html += "<dt>" + heading + "</dt>";
      for (const [label, url] of links) {
        inner_html += "<dd><a href='" + url + "'>" + label + "</a></dd>";
      }
    }
    inner_html +=
          "</dl>" +
          "<hr>" +
          "<small>Generated by <a href='https://goerz.github.io/docs_versions_menu'>Docs Versions Menu</a>" +
          "</small>" +
        "</div>" +
      "</div>";
    menu.innerHTML = inner_html;
    const parent = document.body;
    parent.insertBefore(menu, parent.lastChild);

    // Add a warning banner for dev/outdated versions
    let warning;
    let msg;
    if (version_data["warnings"][current_folder].indexOf("outdated") >= 0) {
      warning = document.createElement('div');
      warning.setAttribute('class', 'admonition danger');
      msg = "This document is for an <strong>outdated version</strong>.";
    } else if (version_data["warnings"][current_folder].indexOf("unreleased") >= 0) {
      warning = document.createElement('div');
      warning.setAttribute('class', 'admonition danger');
      msg = "This document is for an <strong>unreleased development version</strong>.";
    } else if (version_data["warnings"][current_folder].indexOf("prereleased") >= 0) {
      warning = document.createElement('div');
      warning.setAttribute('class', 'admonition danger');
      msg = "This document is for a <strong>pre-release development version</strong>.";
    }
    if (warning !== undefined) {
      if (version_data["latest"] !== null) {
        if (url_version_scheme === 'translations') {
          const latestLang = docsVersionMenu._findFallbackLanguage(
            available_languages, version_data["latest"], current_language, default_language
          );
          msg = msg + " Documentation is available for the " + "<a href='" +
            docsVersionMenu._buildUrl(url_version_scheme, rootUrl, version_data["latest"], current_path, latestLang) +
            "'>latest public release</a>.";
        } else {
          msg = msg + " Documentation is available for the " + "<a href='" +
            docsVersionMenu._buildUrl(url_version_scheme, rootUrl, version_data["latest"], current_path) +
            "'>latest public release</a>.";
        }
      }
      warning.innerHTML = "<p class='first admonition-title'>Note</p> " +
        "<p class='last'> " + msg + "</p>";
      const warn_parent = document.querySelector('div.body')
        || document.querySelector('div.document')
        || document.body;
      warn_parent.insertBefore(warning, warn_parent.firstChild);
    }
  }

  /**
   * @typedef {Object} MenuOptions
   * @property {boolean} [badgeOnly=true] - If true, the menu is rendered
   *     as a small collapsed badge (in the style of Read the Docs) that
   *     expands into the full menu when clicked. If false, the menu is
   *     rendered in a way allowing its integration in sphinx_rtd_theme.
   * @property {string} [menuTitle="Docs"] - Label displayed in front of
   *     the current version (e.g. "Docs v1.2.0"). Only shown when
   *     `badgeOnly` is false.
   * @property {?ProjectLinks} [projectLinks=null] - Custom sections of
   *     links added to the menu, below "Downloads". Each key is a section
   *     heading (rendered as a `<dt>`), mapping to an object of link
   *     labels to URLs (each rendered as a `<dd><a>`). Setting this option
   *     (even to an empty object) disables the automatic auto-detection of
   *     a Github project URL described for `githubProjectUrl`; set
   *     `githubProjectUrl` explicitly alongside `projectLinks` to still
   *     include an "On GitHub" section, rendered after the sections from
   *     `projectLinks`.
   * @property {?string} [githubProjectUrl=null] - **Deprecated**: use
   *     `projectLinks` instead. URL of the project's GitHub repository.
   *     When set to a non-empty string, an "On GitHub" section is added to
   *     the menu, linking to the project home and its issue tracker. When
   *     left as `null` (the default) and `projectLinks` is also left
   *     unset, the URL is instead auto-detected from the root URL,
   *     assuming it follows the `<user-or-org>.github.io/<project>` GitHub
   *     Pages convention; if that detection fails, the section is omitted.
   *     Passing an empty string explicitly disables the section, without
   *     attempting auto-detection.
   */

  /**
   * Displays the version menu.
   *
   * Loads versions.json (via `loadVersionData`), builds the
   * version-selector menu, and inserts it at the end of the page body.
   * Also inserts a warning banner near the top of the document body if
   * the current version is flagged in versions.json as outdated,
   * unreleased, or a pre-release.
   *
   * When versions.json contains `"url-version-scheme": "translations"`,
   * the menu also shows a "Translations" section for switching between
   * the language editions available for the current version.
   *
   * @param {MenuOptions} [options] - Configuration for the version menu.
   *     Any option that is omitted falls back to its default value (see
   *     MenuOptions).
   * @returns {Promise<VersionData>} The versions.json file content.
   */
  docsVersionMenu.addVersionsMenu = async function(options) {
    // set default values
    options = Object.assign({
      badgeOnly: true,
      menuTitle: "Docs",
      projectLinks: null,
      githubProjectUrl: null,
    }, options);

    const rootUrl = await docsVersionMenu.getRootUrl();
    const version_data = await docsVersionMenu.loadVersionData(rootUrl);
    docsVersionMenu._addVersionsMenu(version_data, rootUrl, options);

    if (options.badgeOnly) {
      document.body.addEventListener('click', function(e) {
        if (e.target.closest('div.rst-versions.rst-badge')) {
          document.querySelectorAll('.rst-other-versions').forEach(
            el => { el.style.display = window.getComputedStyle(el).display === 'none' ? 'block' : 'none'; }
          );
          document.querySelectorAll('.rst-versions .rst-current-version .fa-book').forEach(
            el => el.classList.toggle('shift-up')
          );
        }
      });
    }
    return version_data;
  }

  // Node.js or browser
  if (typeof module !== 'undefined') module.exports = docsVersionMenu;
  else root.docsVersionMenu = docsVersionMenu;

}(this));
