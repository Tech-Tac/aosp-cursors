# AOSP Cursors for Linux

![Banner](banner.png)

This is a cursor theme for KDE and other environments that brings
the default Android cursor set to your desktop, freshly extracted
from AOSP source code and faithfully converted to scalable cursors
for your pleasure, available in virtually all sizes and colors.

## Installation

On KDE, go to System Settings > Colors & Themes > Cursors > Get New...
and search for "AOSP Cursors" then click Install. It should be available
in the Cursors page now, select it and press Apply.

You can also download the latest `.tar.gz` file from releases or from the
OpenDesktop store (https://www.opendesktop.org/p/2361737) then load it into
your desktop environment's cursor configuration page, you can alternatively
extract the archive into `~/.icons/`.

## Building & Customization

You need the following dependencies to build this theme from source:
- `bun` for the JavaScript runtime
- `kcursorgen` (pre-installed with Plasma) for SVG to XCursor conversion

Once those are installed you can then run `bun run build_theme.js` to build
the theme, it should be ready in about 4 seconds as a `.tar.gz` file in the
project directory.

You can further customize the theme by editing the
`color_map.json` file and the configuration variables at the top of
`build_theme.js` then rebuilding.

The script should also work with cursor vectors from other ROMs given they
follow the same format, please open an issue if that doesn't work.

## Licenses

Android assets included in this project are property of their
respective owners and are distributed under the Apache 2.0 license,
the full license text can be found in the `NOTICE` file.

Other code in this project is property of @Tech-Tac and is licensed under
the GPLv3, the full license text can be found in the `LICENSE` file.