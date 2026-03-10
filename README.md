# FileFlow CLI

> A smart command-line tool to automate repetitive file tasks — organize, rename, convert, and find duplicates in seconds.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/license-MIT-blue)
![Status](https://img.shields.io/badge/status-active-brightgreen)

---

## Features

| Command | Description |
|---|---|
| `organize` | Auto-sort files into folders by type, date, or size |
| `rename` | Bulk rename using templates, find/replace, or case conversion |
| `convert` | Convert data files between CSV, JSON, and Excel |
| `duplicates` | Find and remove duplicate files using MD5 hashing |
| `watch` | Monitor a folder and auto-process new files |

---

## Installation

```bash
# Install globally from npm
npm install fileflow-clitool

# Or clone and link locally
git clone https://github.com/Vall-Here/fileflow-cli.git
cd fileflow-cli
npm install
npm link
```

---

## Usage

### `organize` — Sort files into folders

```bash
# Sort by file type (images, documents, videos...)
fileflow organize ./downloads

# Sort by month (2024-01, 2024-02...)
fileflow organize ./photos --by date

# Sort by size (small, medium, large, huge)
fileflow organize ./downloads --by size

# Preview without moving anything
fileflow organize ./downloads --dry-run

# Include subdirectories
fileflow organize ./downloads --recursive
```

### `rename` — Bulk rename files

```bash
# Rename with a template
fileflow rename ./invoices --pattern "invoice_{date}_{index:3}"
# → invoice_2024-01-15_001.pdf, invoice_2024-01-16_002.pdf

# Find and replace in filenames
fileflow rename ./photos --find "IMG_" --replace "photo_"
# → photo_001.jpg, photo_002.jpg

# Change case style
fileflow rename ./docs --case kebab
# → my-document.pdf, another-file.txt

# Only rename .jpg files
fileflow rename ./photos --case snake --ext jpg

# Preview first
fileflow rename ./files --pattern "{name}_{date}" --dry-run
```

**Template tokens:**

| Token | Description | Example |
|---|---|---|
| `{name}` | Original filename (no extension) | `report` |
| `{ext}` | File extension | `pdf` |
| `{index}` | Sequential number | `1`, `2`, `3` |
| `{index:3}` | Zero-padded number | `001`, `002` |
| `{date}` | File modification date | `2024-01-15` |
| `{timestamp}` | Unix timestamp | `1705276800` |

### `convert` — Convert data files

```bash
# Single file
fileflow convert data.csv --to json
fileflow convert data.json --to xlsx
fileflow convert data.xlsx --to csv

# Batch convert entire folder
fileflow convert ./data-folder --to json

# Specify Excel sheet
fileflow convert report.xlsx --to csv --sheet "Sales Q4"

# Custom output directory
fileflow convert data.csv --to json --output ./output

# Minify JSON output
fileflow convert data.csv --to json --minify
```

### `duplicates` — Find and clean duplicates

```bash
# Find duplicates (report only)
fileflow duplicates ./downloads

# Include subdirectories
fileflow duplicates ./photos --recursive

# Preview what would be deleted
fileflow duplicates ./downloads --delete --dry-run

# Actually delete duplicates (keeps first copy)
fileflow duplicates ./downloads --delete
```

### `watch` — Auto-process new files

```bash
# Watch and auto-organize by file type
fileflow watch ./downloads

# Watch and organize by date
fileflow watch ./inbox --by date
```

---

## Project Structure

```
fileflow-cli/
├── bin/
│   └── fileflow.js          # CLI entry point
├── src/
│   ├── commands/
│   │   ├── organize.js      # File organizer
│   │   ├── rename.js        # Bulk renamer
│   │   ├── convert.js       # Data converter
│   │   ├── duplicates.js    # Duplicate finder
│   │   └── watch.js         # Folder watcher
│   └── utils/
│       ├── fileHelpers.js   # Shared file utilities
│       └── logger.js        # Consistent CLI output
├── tests/
│   └── commands/
│       └── organize.test.js
├── package.json
└── README.md
```

---

## Development

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Run locally without installing
node bin/fileflow.js organize ./test-folder
```

---

## 🛠️ Tech Stack

- **[Commander.js](https://github.com/tj/commander.js)** — CLI argument parsing
- **[Chalk](https://github.com/chalk/chalk)** — Terminal colors
- **[Ora](https://github.com/sindresorhus/ora)** — Spinner/loading indicators
- **[fs-extra](https://github.com/jprichardson/node-fs-extra)** — Enhanced file operations
- **[PapaParse](https://www.papaparse.com/)** — CSV parsing
- **[SheetJS](https://sheetjs.com/)** — Excel read/write
- **[glob](https://github.com/isaacs/node-glob)** — File pattern matching
- **[Jest](https://jestjs.io/)** — Testing framework

---

## Roadmap

- [ ] Config file support (`.fileflowrc`)
- [ ] Plugin system for custom actions
- [ ] Image resize/compress command
- [ ] Undo last operation
- [ ] Interactive mode with prompts

---

## License

MIT © [Ahmad Noval](https://github.com/vall-here)

---

## Contributing

Pull requests welcome! Please open an issue first to discuss major changes.

```bash
git checkout -b feature/your-feature
npm test
git commit -m "feat: add your feature"
git push origin feature/your-feature
```
