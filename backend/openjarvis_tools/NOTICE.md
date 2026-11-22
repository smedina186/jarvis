# OpenJarvis subset

Source: https://github.com/open-jarvis/OpenJarvis
Revision: 5a9b5268f2432f7ea4fe402e384ecb6b64a649bb
Original: src/openjarvis/agents/loop_guard.py
SHA256 original: 163a3915cfe8baf3853089639a3176b32cbcbae76a1144c06343ff2f4d068aaf
License: Apache-2.0, included as LICENSE.openjarvis.

Changes: disable Rust discovery; remove OpenJarvis event bus imports/emission.
Only the Python loop guard is vendored. No package installer, model downloader,
telemetry, shell, external skills collection or local SQLite scheduler is run.
JARVIS workflows in runtime.py are integration code, not the upstream orchestrator.
This is a selective source integration, NOT installation of the full framework.
