/* eslint-disable no-template-curly-in-string */

module.exports = {
  branches: ["master"],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "angular",
        releaseRules: [
          {
            type: "Feature",
            release: "minor",
          },
          {
            type: "Fix",
            release: "patch",
          },
          {
            type: "Docs",
            release: "patch",
          },
          {
            type: "Style",
            release: "patch",
          },
          {
            type: "Refactor",
            release: "minor",
          },
          {
            type: "Test",
            release: "patch",
          },
        ],
        parserOpts: {
          noteKeywords: ["BREAKING CHANGE", "BREAKING CHANGES"],
        },
      },
    ],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
      },
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "package-lock.json"],
        message:
          "Feature(Version): ${nextRelease.gitTag} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    // "@semantic-release/github",
  ],
};
