# AOSP Cursors for Linux

This is a cursor theme for KDE and other environments that brings
the default Android cursor set to your desktop, freshly extracted
from AOSP source code and faithfully converted to scalable cursors
for your pleasure, available in virtually all sizes and colors.

## Customization

You can further customize this cursor theme by editing the
`color_map.json` file and the configuration variables at the top
of `build_theme.js` then regenerating the theme by running
`bun run build_theme`. Your theme will be ready in about 4 seconds
and will be available as a `tar.gz` in the project directory,
you can then drag or load the archive into your environment
cursor configuration page.

Please note that you need `kcursorgen` (preinstalled with Plasma)
and `bun` to build this theme, you may then use the resulting theme
file on any system without these dependencies installed.

The script should also convert cursor sets from other ROMs given they
follow the same format, please open an issue if that doesn't work.

## Licenses

Android assets included in this project are property of their
respective owners and are distributed under the Apache 2.0 license,
the full license text can be found in the `NOTICE` file.

Other code in this project is property of @Tech-Tac and licensed under
the GPLv3, the full license text can be found in the `LICENSE` file.