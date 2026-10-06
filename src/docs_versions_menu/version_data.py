"""Implementation of the versions-data collection."""

import logging
import re
from pathlib import Path, PurePosixPath

import jinja2
from fsspec.implementations.dirfs import DirFileSystem

from .folder_spec import resolve_folder_spec
from .groups import get_groups
from .url_scheme import UrlVersionScheme


def get_version_data(
    *,
    fs: DirFileSystem,
    url_version_scheme: UrlVersionScheme,
    suffix_latest,
    default_branch_spec,
    versions_spec,
    latest_spec,
    warnings,
    label_specs,
    downloads_file=None,
    default_language='en',
):
    """Get the versions data, to be serialized to json."""
    logger = logging.getLogger(__name__)

    folders_and_langs = _collect_folders_and_languages(fs, url_version_scheme)
    folders = list(folders_and_langs.keys())

    default_branches = resolve_folder_spec(
        default_branch_spec, {'all': folders}
    )
    try:
        default_branch = default_branches[0]
        logger.debug(
            "Setting default_branch to %r from %r",
            default_branch,
            default_branches,
        )
    except IndexError:
        default_branch = None
        logger.warning("No default branch")
    groups = get_groups(folders, default_branches=default_branches)

    labels = {}
    for spec, template_str in label_specs:
        label_folders = resolve_folder_spec(spec, groups)
        for folder in label_folders:
            label_template = jinja2.Environment().from_string(template_str)
            labels[folder] = label_template.render(folder=folder)
    for folder in folders:
        if folder not in labels:
            labels[folder] = folder

    try:
        latest = resolve_folder_spec(latest_spec, groups)[-1]
        labels[latest] += suffix_latest
    except IndexError:
        latest = None

    # any changes here should be reflected in the documentation
    # for "Custom warning messages"
    if 'outdated' not in warnings:
        warnings['outdated'] = '(<releases> < ' + str(latest) + ')'
        # spec '(<releases> < None) is an empty list
    if 'unreleased' not in warnings:
        warnings['unreleased'] = '<branches>, <local-releases>'
    if 'prereleased' not in warnings:
        warnings['prereleased'] = '<pre-releases>'
    versions = resolve_folder_spec(versions_spec, groups)
    versions = list(reversed(versions))  # newest first
    version_data = {
        # URL version scheme: 'no-translations' or 'translations'
        'url-version-scheme': str(url_version_scheme),
        # list of *all* folders
        'folders': folders,
        #
        # the name of the default branch (None if default-branch folder exists)
        'default-branch': default_branch,
        #
        # folder => labels for every folder in "Versions"
        'labels': labels,
        #
        # list folders that appear in "Versions"
        'versions': versions,
        #
        # map of folders to warning labels
        'warnings': {f: [] for f in folders},
        #
        # the latest stable release folder
        'latest': latest,
        #
        # folder => list of (label, file)
        'downloads': {folder: [] for folder in folders},
    }

    if url_version_scheme == UrlVersionScheme.TRANSLATIONS:
        version_data['default-language'] = default_language
        version_data['available-languages'] = {
            k: sorted(v) for k, v in folders_and_langs.items()
        }

    if downloads_file is None:
        logger.debug("Disable download links (downloads_file is None)")
    else:
        version_data['downloads'] = {
            folder: _find_downloads(
                fs,
                _downloads_path(folder, url_version_scheme, default_language),
                downloads_file,
            )
            for folder in folders
        }

    for name, warning_spec in warnings.items():
        warning_folders = resolve_folder_spec(warning_spec, groups)
        for folder in version_data['warnings'].keys():
            if folder in warning_folders:
                version_data['warnings'][folder].append(name)

    return version_data


def _collect_folders_and_languages(
    fs: DirFileSystem,
    url_version_scheme: UrlVersionScheme,
) -> dict[str, set[str]]:
    """Collect version folders and language availability.

    Returns a dict mapping each folder to the set of languages that have it
    (empty set in no-translations mode).
    """
    match url_version_scheme:
        case UrlVersionScheme.NO_TRANSLATIONS:
            all_paths = fs.ls('.', detail=False)
            folders = sorted(
                Path(p).name
                for p in all_paths
                if fs.isdir(p)
                and not Path(p).name.startswith('.')
                and not Path(p).name.startswith('_')
            )
            return {f: set() for f in folders}

        case UrlVersionScheme.TRANSLATIONS:
            all_paths = fs.ls('.', detail=False)
            languages = sorted(
                Path(p).name
                for p in all_paths
                if fs.isdir(p)
                and not Path(p).name.startswith('.')
                and not Path(p).name.startswith('_')
            )

            lang_versions: dict[str, set[str]] = {}
            for lang in languages:
                lang_paths = fs.ls(lang, detail=False)
                versions = {
                    Path(p).name
                    for p in lang_paths
                    if fs.isdir(p)
                    and not Path(p).name.startswith('.')
                    and not Path(p).name.startswith('_')
                }
                lang_versions[lang] = versions

            result: dict[str, set[str]] = {}
            for lang, versions in lang_versions.items():
                for v in versions:
                    result.setdefault(v, set()).add(lang)
            return dict(sorted(result.items()))

        case _:
            raise NotImplementedError(
                f"Unsupported URL version scheme: {url_version_scheme}"
            )


def _downloads_path(
    folder: str, url_version_scheme: UrlVersionScheme, default_language: str
) -> str:
    """Return the filesystem path prefix for a given version folder."""
    match url_version_scheme:
        case UrlVersionScheme.NO_TRANSLATIONS:
            return str(folder)
        case UrlVersionScheme.TRANSLATIONS:
            return str(PurePosixPath(default_language) / folder)
        case _:
            raise NotImplementedError(
                f"Unsupported URL version scheme: {url_version_scheme}"
            )


def _find_downloads(
    fs: DirFileSystem,
    folder,
    downloads_file,
):
    """Find artifact links in downloads_file file.

    The `downloads_file` should be created during the build procedure (on
    Travis).  If no `downloads_file` exists, return an empty list.

    Each line in the `downloads_file` should have the form ``[label]: url``.
    For backwards compatibility, having only the url is also acceptable. In
    this case, the label is derived from the file extension.
    """
    logger = logging.getLogger(__name__)
    downloads = []
    rx_line = re.compile(r'^\[(?P<label>.*)\]:\s*(?P<url>.*)$')
    rx_url = re.compile(r'^(\w+:/)?/')  # /... or http://...
    downloads_path = str(PurePosixPath(folder) / downloads_file)
    try:
        with fs.open(downloads_path, 'r') as in_fh:
            logger.debug("Processing downloads_file %s", downloads_path)
            for line in in_fh:
                match = rx_line.match(line)
                if match:
                    url = match.group('url')
                    label = match.group('label')
                else:
                    logger.warning(
                        "Invalid line %r in %s: does not match '[label]: url'",
                        line.strip(),
                        downloads_path,
                    )
                    url = line.strip()
                    label = url.split(".")[-1].lower()
                if not rx_url.match(url):
                    logger.error("INVALID URL: %s", url)
                    logger.warning(
                        "Skipping invalid URL %r (must be absolute path or "
                        "external URL)",
                        url,
                    )
                    continue
                logger.debug(
                    "For %s, download link %r => %r", folder, label, url
                )
                downloads.append((label, url))
    except IOError:
        logger.warning("folder '%s' contains no %s", folder, downloads_path)
    return downloads
