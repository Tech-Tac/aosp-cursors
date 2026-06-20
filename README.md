# AOSP Cursors for Linux & Windows

![Banner](banner.png)

This is a cursor theme for Linux and Windows that brings the default
Android cursor set to your desktop, freshly extracted from AOSP source
code and faithfully converted to sharp, scalable, multi-platform cursors,
available in virtually all sizes and colors[\*](#building--customization).

## Installation

On KDE, go to System Settings > Colors & Themes > Cursors > Get New...
and search for "AOSP Cursors" then click Install. It should be available
in the Cursors page now, select it and press Apply.

You can also download the latest `-linux.tar.xz` file from releases or from the
OpenDesktop store (https://www.opendesktop.org/p/2361737) then load it into
your desktop environment's cursor configuration page, you can alternatively
extract the archive into `~/.icons/`.

On Windows, download the latest `-windows.zip` file from releases,
extract it, right click `install.inf` and select "Install".

## Building & Customization

You need the following dependencies to build this theme from source:
- `bun` for the JavaScript runtime
- `kcursorgen` (part of the `breeze` package) for SVG to XCursor conversion
  - OR [this script](https://github.com/jinliu/svg-cursor/tree/main/svg-theme-to-xcursor)
- `xcursorgen` (from `xorg-xcursorgen`), required by `kcursorgen`
- GNU `tar` for Linux packaging
- optionally `win2xcur` (from pip) for building a windows theme
- optionally `zip` for Windows packaging

After cloning the repo, run `bun install` to install the npm dependencies.

Once everything is ready you can run `bun run build_theme.js` to build
the theme, it should be ready as a `.tar.xz` file in the `output` directory.

To build the theme for Windows, run `BUILD_WINDOWS=true bun run build_theme.js`.

> [!IMPORTANT]
> Please note that building a Windows theme directly on Windows still requires
> getting xcursorgen to work, you may want to try WSL or another Linux
> environment of some sort.

You can further customize the theme by editing `color_map.json` for stroke/fill
color substitution, and the configuration variables at the top of `build_theme.js`
for controlling available sizes and shadow parameters. Make sure to rebuild after
making your desired changes.

The script should also work with cursor drawables from other ROMs given that they
follow the same format, please open an issue if that doesn't work.

## Licenses & Attribution

The distributed theme is modified from original AOSP assets, with the changes
being converting the VectorDrawables to SVGs, XCursors, and .ani/.cur files, in
addition to extending the design with drop shadows.

Android assets included in this project are property of their
respective owners and are distributed under the Apache 2.0 license,
the full license text can be found in the `NOTICE` file.

Other code in this project is property of @Tech-Tac and is licensed under
the GPLv3, the full license text can be found in the `LICENSE` file.