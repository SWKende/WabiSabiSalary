#!/bin/bash
# trae-salary dev launcher — double-click stub.
#
# This stub exists because:
#   1. macOS Finder only routes `.command` files through Terminal.app on
#      double-click — that suffix is what makes the file "user-launchable".
#   2. Node 24's ESM loader refuses to import files with unknown extensions
#      (it throws ERR_UNKNOWN_FILE_EXTENSION on `.command`).
#
# So we keep the double-click UX by being a `.command` file, but the actual
# logic lives in `start-dev.mjs` (which Node 24 will load as ES module).
# `exec` replaces this bash process with the Node process — Ctrl+C reaches
# Node directly, so its signal handler (not bash's deferred trap) fires.

cd "$(dirname "$0")" || exit 1
exec node ./start-dev.mjs "$@"