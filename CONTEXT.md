# Horizon Power Doc Downloader

A single standalone Windows `.cmd` that lets a coworker on a locked-down corporate laptop (no admin, no installs) bulk-download Horizon Power's public technical documents into a tidy folder tree. A maintainer-side scraper regenerates the document list when the source site changes.

## Language

**Downloader**:
The single self-contained `.cmd` file the end user runs. Fetches the manifest live from GitHub and downloads every document. The only artifact an end user ever handles.
_Avoid_: script (ambiguous with the scraper), tool, batch file.

**End user**:
A coworker who runs the Downloader on a locked-down corporate Windows laptop. Non-technical; wants the documents on disk with zero setup.
_Avoid_: customer, client.

**Maintainer**:
The person who runs the Scraper, reviews the result, and pushes an updated manifest or Downloader to GitHub.

**Scraper**:
The maintainer-side Playwright script that reads the Horizon Power page and regenerates the Manifest. Runs on the maintainer's machine only; never shipped to end users.

**Manifest**:
The machine-generated list of every document to download, grouped Tab then Table then Document, published as `manifest.json` and fetched live by the Downloader on each run. An old Downloader still gets current documents because the Manifest is always pulled fresh.

**Tab**:
One of the top-level sections on the Horizon Power page (Manuals, Standards, Metering, Industry resources). Becomes a top-level folder. The Downloader's menu lets the user pick one Tab or all.

**Table**:
A titled listing of documents within a Tab. Becomes a sub-folder under its Tab. A Table with no detectable title falls back to the folder name **Uncategorised**.

**Document**:
A single downloadable file (a PDF) with a display title, a URL, and a size label. Its on-disk filename is derived from the title; the extension comes from the URL.

**Update notice**:
The one-line, ignorable message the Downloader prints when a newer Downloader version exists. Notify-only: the Downloader never modifies itself, and the notice never changes what gets downloaded.
_Avoid_: self-update, auto-update.
