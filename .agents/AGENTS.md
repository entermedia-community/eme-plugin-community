# AGENTS.md

## Community Plugin Guide

### Purpose

`plugins/community` contains the community-facing feature set for the EME server stack. It wires Java modules, provides the community HTML templates, and hosts community-specific test and support assets.

### Folder Map

- `html/default` Main community UI and fallback templates
- `html/blog` Blog-related templates and pages
- `html/src/plugin.xml` Spring-style bean wiring for community modules
- `html/src/depends.xml` Plugin dependency metadata
- `code/org` Java implementation code for the community plugin
- `lib` Plugin-local jars, if any are required
- `work/tests` Test sources and scratch test fixtures

### What This Plugin Owns

- Community and project-oriented screens
- Site and profile loaders
- Failover, SSL, speed test, invoice, transaction, finance, and bank account modules
- Asset and socket-related community services registered through `plugin.xml`

### Editing Rules

- Prefer changing the smallest file that owns the behavior.
- Java changes belong under `code/org` and usually require a rebuild/restart.
- Bean registration changes belong in `html/src/plugin.xml`.
- HTML template changes under `html/default` or `html/blog` are typically visible after reload, but any xconf or bean wiring change may require cache clear or server restart.
- Keep package names and bean ids aligned with the existing `org.openinstitute` and `org.entermedia` conventions.

### Validation Checklist

1. Verify the file type matches the intended change: HTML, XML, or Java.
2. Rebuild the Java classes after edits in `code/org`.
3. Reload the site or clear the page cache after xconf or template routing changes.
4. Confirm the affected community page or bean loads without errors in logs.

### Notes For Agents

- The plugin is part of the larger EME fallback model, so behavior may come from parent plugins if a file is missing here.
- When debugging, check whether the request resolves through `html/default` before assuming the issue is in this plugin.