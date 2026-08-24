---
name: add-community-view
description: Use this skill when the user wants to add a new page/view to the community plugin — requests like "add a new community page for X", "create a view under project", or "add a settings screen to the community UI". Covers creating the HTML template, its .xconf, and (if the page needs server logic) wiring a bean in plugin.xml. Consult this before hand-adding files under plugins/community/html, since layout/inheritance and permission conventions are easy to get wrong.
---

# Add a Community View

Adds a new page to the community plugin's HTML tree, following this project's fallback/layout
conventions.

## Step 1: Pick the folder

Community pages live under `html/default/<section>/` (e.g. `project`, `blog`, `profile`,
`users`). Put the new page in the section it logically belongs to — new sections are rare, prefer
reusing an existing one.

## Step 2: Create the HTML template

Add `html/default/<section>/<pagename>.html`. Standard EME/Velocity page — it will inherit layout
and styling from parent `.xconf`/`_site.xconf` files via the fallback chain
(`/eme -> /finder/find -> /community/default`).

## Step 3: Add the page's `.xconf`

Add `html/default/<section>/<pagename>.xconf` next to the HTML file if the page needs its own
permissions, layout override, or path-actions, e.g.:

```xml
<page>
	<permission name="view">
		<blank/>
	</permission>
	<inner-layout>/${applicationid}/theme/layouts/layout.html</inner-layout>
</page>
```

If the page needs no special settings, the `_site.xconf` in its folder (or a parent folder) is
enough and no per-page `.xconf` is required.

## Step 4: Wire server logic (only if needed)

If the page needs a Java-backed module or loader (e.g. a custom Loader like
`org.openinstitute.community.ProjectLoader`), add/extend a bean in `html/src/plugin.xml`:

```xml
<bean id="myLoader" class="org.openinstitute.community.MyLoader" scope="prototype">
	<property name="moduleManager">
		<ref bean="moduleManager" />
	</property>
	<property name="pageManager">
		<ref bean="pageManager" />
	</property>
</bean>
```

Keep package names under `org.openinstitute` or `org.entermedia` to match existing convention.

## Step 5: Validate

1. Rebuild Java classes if `plugin.xml` or `code/org` changed.
2. Clear the page cache (or restart) if any `.xconf`/`_site.xconf` changed.
3. Load the new page and confirm it renders through the expected layout and permission.
4. Check server logs if the bean fails to wire (missing property refs are the most common cause).
