Release Checklist

This repo publishes two artifacts for each release:

npm package: @tingwdsj/pi-web (kept from upstream for compatibility)
GitHub Release: datnguyentien2006/pi-web

Use this checklist from a clean main checkout.

1. Preflight
bash
git status --short --branch
git log --oneline --decorate -5
gh auth status
npm whoami
node -e "const p=require('./package.json'); console.log(p.version)"

Expected:

git status is clean, or only contains changes you intentionally plan to release.
GitHub is authenticated as an account that can push and create releases.
npm is authenticated as an account that can publish @tingwdsj/pi-web.

Note: this fork keeps the upstream package name @tingwdsj/pi-web so that existing installs and CLI references stay compatible. If you plan to publish under a different scope (e.g. @datnguyentien2006/pi-web), update package.json name first — this is a breaking change for any consumer.

2. Publish to npm (optional)

If you are only publishing a GitHub Release (no npm), skip to section 3.

bash
npm run release

The release script runs:

bash
npm version patch --no-git-tag-version && npm run build && npm publish --access public

Notes:

This bumps package.json and package-lock.json.
It intentionally runs a production build. Do not run next build during normal development; release work is the exception.

If npm view @tingwdsj/pi-web version briefly shows the previous version, check the exact version instead:

bash
npm view @tingwdsj/pi-web@<version> version --registry https://registry.npmjs.org/
npm view @tingwdsj/pi-web versions --json --registry https://registry.npmjs.org/
3. Commit the Version Bump

Replace <version> with the new package version, for example 0.8.1.

bash
git diff -- package.json package-lock.json
git add package.json package-lock.json
git commit -m "Release v<version>"
4. Tag and Push
bash
git tag -a v<version> -m "v<version>"
git push origin main --tags

Confirm the tag does not already exist before creating it when unsure:

bash
git ls-remote --tags origin v<version>
gh release view v<version> --repo datnguyentien2006/pi-web
5. Generate Release Notes from Commits

Use the previous release tag as the base.

bash
git log --oneline --decorate v<previous>..v<version>
git log --format='%h%x09%s%n%b' v<previous>..v<version>
git diff --stat v<previous>..v<version>

Write the release notes from those commits, not from memory. Include both English and Vietnamese sections. Keep commit hashes next to each item when useful.

Suggested structure:

markdown
## English

Prepared from commits in `v<previous>..v<version>`.

### Added

- ...

### Fixed

- ...

### Improved

- ...

### Internal

- Published npm package `@tingwdsj/pi-web@<version>` (if applicable).

## Tiếng Việt

Tổng hợp từ các commit trong khoảng `v<previous>..v<version>`.

### Thêm mới

- ...

### Sửa lỗi

- ...

### Cải thiện

- ...

### Nội bộ

- Phát hành gói npm `@tingwdsj/pi-web@<version>` (nếu có).
6. Create or Update the GitHub Release

Create a new release:

bash
gh release create v<version> \
  --repo datnguyentien2006/pi-web \
  --verify-tag \
  --title "v<version>" \
  --notes-file release-notes.md

If the release already exists and only the notes need updating:

bash
gh release edit v<version> \
  --repo datnguyentien2006/pi-web \
  --notes-file release-notes.md

You can avoid a temporary file by passing notes through stdin:

bash
gh release edit v<version> --repo datnguyentien2006/pi-web --notes-file - <<'EOF'
## English

...

## Tiếng Việt

...
EOF
7. Final Verification
bash
gh release view v<version> --repo datnguyentien2006/pi-web
npm view @tingwdsj/pi-web@<version> version --registry https://registry.npmjs.org/  # if published
git status --short --branch
git log --oneline --decorate -3

Expected:

GitHub Release exists and is not a draft unless intentionally published as one.
npm exact version resolves (if you published).
main is aligned with origin/main.
HEAD points at the release commit and v<version> tag.