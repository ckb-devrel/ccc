# Contributing to ccc

First off, thank you for considering contributing to ccc! We appreciate your help in making ccc a better tool.

## Where do I go from here?

If you've noticed a bug or have a feature request, we'd appreciate it if you [make one](https://github.com/ckb-devrel/ccc/issues/new)! It's generally best if you get confirmation of your bug or approval for your feature request this way before starting to code.

## Guiding Principles

When contributing to ccc, please keep the following principles in mind. These guidelines are designed to ensure that ccc is not only a powerful tool but also a pleasure to use for developers.

*   **Design for the Majority**: Prioritize the most common use cases. Strive to make these scenarios as intuitive and frictionless as possible.
*   **Usability Over Performance**: While performance is important, the ease of use and overall developer experience should always be the primary consideration. A slight performance trade-off is acceptable if it leads to a more intuitive API or a clearer development process.
*   **Good Developer Experience is Key**: Code that simply "works" is not enough. Aim to write code that is a joy to work with. This includes clear naming, comprehensive documentation, and a logical, predictable API. A positive developer experience is a feature in itself.

In summary, our goal is to create a tool that is both powerful and developer-friendly. By focusing on the most common use cases, prioritizing usability, and striving for a great developer experience, we can build a better ccc for everyone.

### Fork & create a branch

If you'd like to contribute a fix, you can [fork ccc](https://github.com/ckb-devrel/ccc/fork) and create a branch with a descriptive name.

A good branch name would be in the format of `<type>/<description>`, for example:

```sh
git checkout -b feat/add-new-api
```

Or for a bug fix:

```sh
git checkout -b fix/resolve-memory-leak
```

### Get the project running

To get the project running on your local machine, please run:
```sh
pnpm install
```

### Make your changes

Now you can modify the code to fix the bug or add the feature.

### Run tests

Please make sure the tests pass before you commit your changes.

```sh
pnpm test
```

### Lint and format your code

We use ESLint for linting and Prettier for formatting. Please ensure your code is clean before committing.

```sh
pnpm lint
pnpm format
```

### Commit your changes

Please add a changeset for your changes. This is how we track changes and generate changelogs.

```sh
pnpm changeset
```

This will ask you a few questions and then generate a file in the `.changeset` directory. Please add this file to your commit.

### Commit Message Format

We use the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for our commit messages. This allows for easier automation of changelog generation and versioning.

Here are a few examples of good commit messages:

- A commit that fixes a bug:
  ```
  fix(parser): handle multi-byte characters
  ```
- A commit that adds a new feature:
  ```
  feat(api): add new endpoint for user profiles
  ```
- A commit that includes a breaking change:
  ```
  feat(auth)!: remove support for deprecated authentication method

  BREAKING CHANGE: The old authentication method is no longer supported. Please upgrade to the new method.
  ```

### Push to your fork and submit a pull request

After pushing your changes to your fork, please submit a pull request to the `master` branch of the `ckb-devrel/ccc` repository.

After submitting the pull request, our team will review it. We may suggest some changes or improvements or alternatives.

### Keep Pull Requests Small and Focused

We prefer small, atomic pull requests over large ones. This makes them easier to review, test, and merge, which means your contributions can be integrated faster. A good pull request is like a single, logical commit.

Here are some more detailed tips for keeping your pull requests small and focused:

*   **One PR, One Concern:** Each pull request should address a single, well-defined issue or feature. Avoid mixing bug fixes, new features, and refactoring in the same pull request. For example, if you find a bug while working on a new feature, first create a PR to fix the bug, and then create a separate PR for the feature.

*   **Break Down Large Features:** If you're implementing a complex feature, don't try to do it all in one giant PR. Instead, break it down into smaller, incremental steps. For example, if you're adding a new UI component, you could have separate PRs for:
    1.  The basic component structure and styling.
    2.  The component's state management.
    3.  The component's integration with the rest of the application.

*   **Separate Refactoring from Features/Fixes:** If you need to refactor existing code to implement your change, do it in a separate PR *before* you start working on the feature or fix. This makes it clear what changes are refactoring and what changes are new functionality, making the review process much smoother. For example, if you need to rename a function that your new feature will use, submit a PR with just the rename first.

*   **Keep an Eye on the Diff:** As you work, regularly check the size of your diff (`git diff`). If it's getting too large (e.g., more than a few hundred lines of changes), it's a good sign that you should probably split your work into multiple PRs.

By following these guidelines, you'll not only make the review process easier for us, but you'll also likely find it easier to manage your own work.

### Interacting with the Gemini Review Bot

We use a Gemini-powered bot to help with pull request reviews. Here's how to interact with it:

*   **Read Gemini's review comments:** The bot will often provide useful suggestions for improving your code. Please read its comments carefully.
*   **Request a re-review:** After you've updated your pull request based on the feedback, you can ask the bot to review your changes again by leaving a comment with `/gemini review`.

To help your pull request get accepted, please consider the following:

- Write tests.
- Follow our existing style.
- Write a good commit message.

### Publishing a Canary Release (for maintainers)

Maintainers can publish a canary release to npm by commenting `/canary` on a pull request. This will trigger a workflow that builds and publishes a new version to npm with the `canary` tag.