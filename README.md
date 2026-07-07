# Horizon Power Doc Downloader

Bulk-download the public technical documents that Horizon Power publishes on its
Manuals and Standards page. One file does everything. You do not need to install
anything, and you do not need admin rights on your laptop.

## For everyone: how to use it

### 1. Get the Downloader

Save the single file `Download-HorizonPower-Docs.cmd` somewhere you can find it,
such as a new folder on your desktop or a work drive. Get it either way:

* Copy it from the shared drive where your team keeps it, or
* Download it from GitHub:
  `https://raw.githubusercontent.com/dthunder746/horizon-power-doc-downloader/main/Download-HorizonPower-Docs.cmd`
  (in your browser, right-click the page and choose "Save as", keeping the
  `.cmd` file name).

Put the file wherever you want the documents to land. It creates its folders next
to itself, so a dedicated folder keeps things tidy.

### 2. Run it

Double-click `Download-HorizonPower-Docs.cmd`. A black window opens and shows a
short menu of sections:

```
Which section do you want to download?

  1. Manuals
  2. Standards
  3. Metering
  4. Industry resources

Enter a number, or press Enter for ALL
```

Type a number and press Enter to get one section, or just press Enter to get
everything. The window shows each file as it downloads and prints a summary when
it finishes. Press a key to close it.

### 3. Find your documents

The files appear in a folder called `Horizon Power Documents`, right next to the
Downloader, organised by section and then by topic:

```
Horizon Power Documents\
  Manuals\
    Technical Rules\
    Safety\
    ...
  Standards\
  Metering\
  Industry resources\
```

A few entries are references that Horizon Power hosts elsewhere (external
standards, other agencies). Those arrive as small web shortcut files (ending in
`.url`) in the same folders. Double-click one to open the reference in your
browser rather than as a saved file.

Running the Downloader again refreshes the files in place. It overwrites the old
copies with the current versions rather than making duplicates, so you always end
up with a clean, current set.

### If something goes wrong

* **"The download manifest is unreachable"** in red means the Downloader could not
  reach the internet. Check your connection or your corporate proxy, then run it
  again. Nothing was downloaded, so it is safe to retry.
* **A few files fail** while most succeed. The Downloader retries each file once,
  then keeps going and lists the count at the end. It writes the details of any
  failures to a file called `download-errors.txt` next to the Downloader. Running
  it again usually clears up a one-off network hiccup.
* **A yellow "A newer version is available" line** appears at the top. This is
  just a heads-up. It never changes what you download, and you can ignore it. When
  it is convenient, grab the fresh Downloader from the link above (or from the
  shared drive) and use that from then on.

## For the maintainer

Everything below is for whoever keeps the document list and the Downloader
current. End users never touch this.

### Regenerate the document list

The Downloader reads a `manifest.json` from GitHub every time it runs. Regenerate
it whenever the Horizon Power page changes:

```
node scraper/scrape.mjs
```

The scraper drives a real Chrome window (via Playwright) so it can pass the
Cloudflare check on the source page. If Playwright is not already available,
populate it once with:

```
npx --yes playwright@latest install chrome
```

After it runs, review the printed document count against the baseline and the
dead-link report, then commit and push the updated `manifest.json`. Because the
Downloader always pulls the manifest fresh, even old copies on people's laptops
pick up the change.

### What counts as a document

The scraper classifies every entry on the page (`classifyDocuments` in
`scraper/transforms.mjs`):

* Files that Horizon Power hosts itself (URLs under
  `horizonpower.com.au/globalassets/`) are downloaded as documents.
* Outside references (other standards bodies, other WA government sites) and
  Horizon Power URLs that only open in a browser are saved as `.url` web
  shortcuts in the same folder, so nothing is silently lost.
* Links that just point back at the source page itself (the page and its in-page
  anchors) are dropped.

The run prints the document count, the shortcut count, and how many self-links
were dropped. If a future run drops the document count sharply, a page selector
probably changed, so check the scraper before committing.

### Version bumps

`version.txt` and the `HP_VERSION` value inside the Downloader track the
Downloader itself, not the documents. Bump both together, to the same value,
whenever you ship a changed Downloader. A guard test (`tests/cmd-sync.test.mjs`)
fails if they drift apart, which protects users from a false "newer version"
nag after a plain copy.

### Notes

* The repository stays public (see `docs/adr/0001-repo-stays-public.md`).
  Everything in it is public Horizon Power material.
* The Downloader never modifies itself. The update check is notify-only by design
  (see `docs/adr/0002-notify-only-embedded-update-check.md`), which keeps its clean behaviour
  with Windows SmartScreen and antivirus.
