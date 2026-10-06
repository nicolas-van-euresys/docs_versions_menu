.. _options:

===============
Program Options
===============

If you do need to customize ``docs-versions-menu``'s behavior, there are two options:

1. Call the ``docs-versions-menu`` executable with explicit command line options
2. Set ``DOCS_VERSIONS_MENU_*`` environment variables, each variable corresponding to a command line option

The latter option is generally preferred.

.. click:: docs_versions_menu.cli:main
   :prog: docs-versions-menu

.. _translations:

Multi-language documentation (translations)
--------------------------------------------

By default, ``docs-versions-menu`` expects one folder per version in the
webroot, e.g. ``v1.0.0/``, ``main/``, and serves documentation under
``/<version>/<filename>``. This is the :option:`--url-version-scheme` value
``no-translations`` (the default value).

For projects that publish documentation in multiple languages, set
:option:`--url-version-scheme` to ``translations``
(``DOCS_VERSIONS_MENU_URL_VERSION_SCHEME=translations``). In that mode, the
webroot is expected to contain one folder per language, each containing one
folder per version, e.g. ``en/v1.0.0/``, ``fr/v1.0.0/``, ``en/main/`` --
documentation is then served under ``/<language>/<version>/<filename>``,
matching the layout used by Read the Docs for its own multi-language
projects.

When using the `translations` mode, the following changes occur:

* The versions menu also gets an additional "Translations" section for
  switching between the languages available for the current version.
* In addition to the `index.html` file usually generated at the webroot,
  additionnal `index.html` files are also generated within each language
  folder. (See used templates at :ref:`customizing_index_html`)

Along with the :option:`--url-version-scheme` option comes the
:option:`--default-language` option, allowing to set the default language
(defaults to `en`). This value is used both by the CLI and JavaScript part
to know which default version to redirect to.

.. note::

  Please note a version does not have to be translated into every language: it
  is perfectly fine for, say, ``en/v1.1.0/`` to exist without a corresponding
  ``fr/v1.1.0/``. ``docs-versions-menu`` records, for every version, which
  languages it is available in or not.

.. _download-links:

Download links
--------------

By default, ``docs-versions-menu`` looks for a file ``_downloads`` inside each
folder that appears in the menu. Each line in this file should have the
markdown-like format ``[label]: url``, e.g.

.. code-block:: md

    [html]: https://dl.bintray.com/goerz/docs_versions_menu/docs_versions_menu-v0.1.0.zip

These links will be shown in the versions menu in a section "Downloads", using
the label as the link text.  The name of the file can be changed via the
``DOCS_VERSIONS_MENU_DOWNLOADS_FILE`` environment variable (see
:option:`--downloads-file`).

See :ref:`github_releases` for an example workflow of creating a suitable
``_downloads`` file from an annotated git tag.

If the ``_downloads`` file is missing, you will see a warning message during
the deploy. To disable use of a ``_downloads`` file (ignore existing files, and
don't warn for missing files), set ``DOCS_VERSIONS_MENU_DOWNLOADS_FILE`` to an
empty string (see :option:`--no-downloads-file`).


Debugging
---------

If the ``docs-versions-menu`` command behaves unexpectedly, set the environment variable

.. code-block:: shell

    DOCS_VERSIONS_MENU_DEBUG=true

or use the :option:`--debug` option.

Make sure to include the debug output when reporting bugs.


Folders
-------

The entries in the versions menu are based on the folders that are present in
the deployed documentation root. We assume here that the folder names
correspond to branch or tag names in the project repository. This is
irrespective of the *label* that appears for given foler in the menu, see
:ref:`below <labels-in-the-versions-menu>`.

By default, the versions menu lists the folder for the default branch (``main``
or ``master``, see :option:`--default-branch`) first, then any releases from
newest to oldest, and then any non-release branches in reverse-alphabetical
order. Having the "newest" releases appear first matches the behavior of
Read-the-Docs.

The folders that are listed in the versions menu and their order can be
customized via the :option:`--versions` flag (``DOCS_VERSIONS_MENU_VERSIONS``
environment variable).
This receives a :ref:`folder specification <folderspecs>` as an argument that
specifies the folders to appear in the menu in reverse order (bottom/right to
top/left).

To un-reverse the default order of folders in the menu, so that the newest
versions and the default branch appear last, you would set

.. code-block:: yaml

    DOCS_VERSIONS_MENU_VERSIONS: '((<branches> not in <default-branch>), <releases>, <default-branch>)[::-1]'

in the definitions of environment variables.


.. _labels-in-the-versions-menu:

Menu labels
-----------

By default, the label for each folder that appears in the menu is simply the
name of the folder. The "latest public release", identified by
:option:`--latest` (the latest public release by default), has
"(latest)" appended. This can be customized with
:option:`--suffix-latest` (``DOCS_VERSIONS_MENU_SUFFIX_LATEST`` environment
variable).

More generally, the :option:`--label` option may be used to define label
templates for specific groups of folders. The option can be given multiple
times. Each :option:`--label` receives two arguments, a :ref:`folder
specification <folderspecs>` for the folders to which the template should
apply, and a Jinja-template-string that should receive the variable ``folder``
for rendering. For example,

.. code-block:: shell

    docs-versions-menu --label '<releases>'  "{{ folder | replace('v', '', 1) }}" --label master '{{ folder }} (latest dev branch)'

drops the initial ``v`` from the folder name of released versions (``v1.0.0`` →
``1.0.0``) and appends a label " (latest dev branch)" to the label for the
``master`` folder.

When specifying the labels via the ``DOCS_VERSIONS_MENU_LABEL`` environment
variable, the multiple ``--label`` options are combined into a single value,
separated by semicolons, and the two arguments separated by a colon. For the
above example, an appropriate definition in a `Github Actions`_ workflow_ would
be

.. code-block:: yaml

    DOCS_VERSIONS_MENU_LABEL: '<releases>: {{ folder | replace("v", "", 1) }}; master: {{ folder }} (latest dev branch)'

.. note::
    Read-the-Docs uses "latest" to refer to the latest development
    version (usually ``main``/``master``) instead of the latest public release,
    and instead labels the latest public release as "stable". You may adopt
    Read-the-Docs nomeclature with e.g.

    .. code-block:: shell

        --suffix-latest=" (stable)" --label master 'master (latest)'

    or

    .. code-block:: shell

        --suffix-latest=" (stable)" --label master latest


Custom warning messages
-----------------------

By default, the ``docs_versions_menu`` extension injects warnings in the
rendered HTML files, within the following types of folders:

* an 'outdated' warning for ``<releases>`` older than the latest public release (identified by :option:`--latest`)
* an 'unreleased' warning for ``<branches>`` (anything that is not a :pep:`440`-conforming release), or ``<local-releases>`` (typically not used)
* a 'prereleased' warning for anything considered a pre-release by :pep:`440`, e.g. ``v1.0.0-rc1``

Which folders are included in the above three categories can be modified via the :option:`--warning` option.
This options receives two arguments, a "warning label" string (the above
'outdated', 'unreleased', or 'prereleased'), and a
:ref:`folder specification <folderspecs>` for the
folders to which the warning should apply. The option can be given multiple
times. An empty specification would disable the warning, e.g.

.. code-block:: shell

    docs-versions-menu --warning prereleased ''

to disable the warning message on pre-releases.

It is also possible to define entirely new warning labels using :option:`--warning`. For example,

.. code-block:: shell

    docs-versions-menu --warning post '<post-releases>'

would define a warning 'post' for all post-releases.

The information about which folders should display which warnings is stored
internally in the resulting ``versions.json`` file, in a dict 'warnings' that
maps folder names to a list of warning labels.

Note that the bundled versions-menu script only recognizes the built-in
'outdated', 'unreleased', and 'prereleased' warning labels; a custom label
like 'post' is stored in ``versions.json`` but will not currently trigger a
warning banner in the menu.

Similarly to :ref:`labels-in-the-versions-menu`, when configuring the warnings
via the ``DOCS_VERSIONS_MENU_WARNING`` environment variable, multiple
:option:`--warning` options are combined into a single value, separated by
semicolons, and the warning label and folder specification separated by a
colon.

For the above two options, you might include the following the definition of
the environment variables in a `Github Actions`_ workflow_:

.. code-block:: yaml

    DOCS_VERSIONS_MENU_WARNING: 'post: <post-relases>; prereleased:'

.. _custom-filesystem:

Custom filesystem backends
--------------------------

By default, ``docs-versions-menu`` reads and writes all files through the
local filesystem. The :option:`--fs-protocol` and :option:`--fs-option`
options expose the underlying `fsspec`_ library, allowing the CLI to operate
directly on any filesystem that fsspec supports — remote object stores, SFTP
servers, memory filesystems for testing, and more.

.. code-block:: shell

    docs-versions-menu --fs-protocol <PROTOCOL> --root-path <PATH> [--fs-option KEY=VALUE ...]

The ``<PROTOCOL>`` string is passed directly to `fsspec.filesystem()`_.
``--root-path`` sets the base path on the remote filesystem where
``docs-versions-menu`` reads and writes files (equivalent to the current
working directory on a local deployment); it defaults to ``"."`` so
existing local-filesystem usage is unchanged.
``--fs-option`` may be given multiple times; each value must have the form
``KEY=VALUE``, where the value is parsed as JSON (so booleans, integers, and
nested objects are accepted natively) and falls back to a plain string when
JSON parsing fails.

Refer to the `fsspec built-in implementations`_ page for the protocols that
ship with fsspec itself, and to `fsspec known implementations`_ for the
broader ecosystem of third-party backends (S3, GCS, Azure, SFTP, …). Most
third-party backends require installing an additional package; fsspec provides
convenience extras for the most common ones (e.g. ``fsspec[s3]`` for S3,
``fsspec[sftp]`` for SFTP).

.. note::

    ``--fs-protocol`` can also be set via the ``DOCS_VERSIONS_MENU_FS_PROTOCOL``
    environment variable (like all other options). For ``--fs-option``, use
    `fsspec's own configuration mechanism`_ instead: fsspec reads
    ``FSSPEC_<PROTOCOL>_<KEY>`` environment variables (and config files)
    directly, so filesystem credentials and options can be supplied that way
    without involving the CLI at all.

.. _fsspec's own configuration mechanism: https://filesystem-spec.readthedocs.io/en/latest/features.html#configuration

**Example — Amazon S3**

Writing output files to an S3 bucket (requires ``fsspec[s3]``, which installs
``s3fs``):

.. code-block:: shell

    DOCS_VERSIONS_MENU_FS_PROTOCOL=s3 \
    docs-versions-menu \
        --root-path my-docs-bucket/webroot/ \
        --fs-option key=AKIAIOSFODNN7EXAMPLE \
        --fs-option secret=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
        --fs-option 'client_kwargs={"region_name":"eu-west-1"}'

**Example — SFTP**

Writing output files to a remote server over SFTP (requires ``fsspec[sftp]``,
which installs ``paramiko``):

.. code-block:: shell

    docs-versions-menu \
        --fs-protocol sftp \
        --root-path /var/www/docs/ \
        --fs-option host=docs.example.com \
        --fs-option username=deploy

.. note::

    Two things always remain local, regardless of the chosen filesystem
    backend:

    * **Template overrides** — ``index.html_t`` and
      ``index_translations_main.html_t`` are looked up in the current working
      directory using the local filesystem, just like any other file you pass
      to the CLI at invocation time.
    * **git staging** — ``git add`` calls are silently skipped when the
      selected protocol is anything other than ``file``. The remote filesystem
      has no git working tree to stage into.

.. _fsspec: https://filesystem-spec.readthedocs.io/en/latest/
.. _fsspec.filesystem(): https://filesystem-spec.readthedocs.io/en/latest/api.html#fsspec.filesystem
.. _fsspec built-in implementations: https://filesystem-spec.readthedocs.io/en/latest/api.html#built-in-implementations
.. _fsspec known implementations: https://filesystem-spec.readthedocs.io/en/latest/api.html#other-known-implementations

.. _Github Actions: https://github.com/features/actions
.. _Github Pages: https://pages.github.com
.. _workflow: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
