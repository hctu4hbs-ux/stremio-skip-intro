# Contributing to Stremio Skip Intro Addon

We welcome contributions to the Stremio Skip Intro Addon! By contributing, you help us improve the experience for all Stremio users.

Please take a moment to review this document to make the contribution process as smooth as possible.

## Code of Conduct

We are committed to fostering an open and welcoming environment. Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) (if applicable, otherwise remove this line).

## How Can I Contribute?

There are several ways you can contribute to this project:

### 1. Reporting Bugs

*   Before submitting a new bug report, please check the [issue tracker](https://github.com/hctu4hbs-ux/stremio-skip-intro/issues) to see if the bug has already been reported.
*   If not, open a new issue and provide as much detail as possible:
    *   A clear and concise description of the bug.
    *   Steps to reproduce the behavior.
    *   Expected behavior vs. actual behavior.
    *   Screenshots or video recordings (if applicable).
    *   Your Stremio version, operating system, and browser (if using Stremio Web).

### 2. Suggesting Enhancements

*   We love new ideas! If you have a suggestion for a new feature or an improvement to an existing one, please open an issue in the [issue tracker](https://github.com/hctu4hbs-ux/stremio-skip-intro/issues).
*   Clearly describe the enhancement and why you think it would be valuable.

### 3. Submitting Pull Requests (Code Contributions)

*   **Fork the repository:** Start by forking the `stremio-skip-intro` repository to your GitHub account.
*   **Clone your fork:**
    ```bash
    git clone https://github.com/YOUR_USERNAME/stremio-skip-intro.git
    cd stremio-skip-intro
    ```
*   **Create a new branch:** Choose a descriptive name for your branch (e.g., `feature/add-new-source`, `bugfix/fix-skip-logic`).
    ```bash
    git checkout -b feature/your-feature-name
    ```
*   **Install dependencies:**
    ```bash
    npm install
    ```
*   **Make your changes:** Implement your feature or bug fix.
*   **Add/Update skip timestamps:** If your contribution involves new skip data, you can add it via the API or by editing `data/catalog.json` directly.
*   **Validate your data:**
    ```bash
    npm run validate
    ```
*   **Test your changes:** Ensure your changes work as expected and don't introduce new issues.
    ```bash
    npm test
    ```
*   **Commit your changes:** Write clear and concise commit messages.
    ```bash
    git add .
    git commit -m 
"feat: Your descriptive commit message"
    ```
*   **Push to your fork:**
    ```bash
    git push origin feature/your-feature-name
    ```
*   **Open a Pull Request:** Go to the original `stremio-skip-intro` repository on GitHub and open a new Pull Request from your forked branch. Provide a clear description of your changes.

### 4. Improving Documentation

*   If you find any errors or areas for improvement in the documentation (e.g., `README.md`), feel free to open an issue or submit a pull request.

## Development Setup

To set up your local development environment, please refer to the [Quick Start Guide](README.md#%EF%B8%8F-quick-start-guide) in the `README.md` file.

## Style Guides

*   **JavaScript:** Follow standard JavaScript best practices. We use ESLint for linting.
*   **Commit Messages:** Please follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification for commit messages.

## Questions?

If you have any questions or need assistance, please open an issue in the [issue tracker](https://github.com/hctu4hbs-ux/stremio-skip-intro/issues) or contact us at **hctu4hbs@gmail.com**.

Thank you for your contributions!
