# Contributing to Copilot Quota Alert

Thank you for your interest in contributing to our project! Whether you're fixing a bug, adding a feature, or improving documentation, we appreciate your help.

## How to Contribute

### 1. Fork and Clone
- **Fork** this repository to your own GitHub account.
- **Clone** your fork locally:
  ```bash
  git clone https://github.com/YOUR_USERNAME/vscode-copilot-quota-alert.git
  cd vscode-copilot-quota-alert
  ```

### 2. Set Up Development Environment
- Install dependencies:
  ```bash
  npm install
  ```
- Compile the project:
  ```bash
  npm run compile
  ```

### 3. Create a Branch
- Create a new branch for your work:
  ```bash
  git checkout -b feature/your-feature-name
  # or
  git checkout -b fix/your-bug-description
  ```

### 4. Make Changes and Test
- Write your code or documentation changes.
- **Run existing tests** to ensure no regressions:
  ```bash
  npm test
  ```
- If you're adding new functionality, please **add new tests** in `src/test/suite/`.
- Verify the extension builds correctly:
  ```bash
  npm run build
  ```

### 5. Submit a Pull Request
- Push your branch to your fork:
  ```bash
  git push origin your-branch-name
  ```
- Open a **Pull Request** from your fork's branch to our `main` branch.
- Provide a clear description of your changes and why they are needed.

## Style Guidelines
- Use **TypeScript** for all logic.
- Follow the existing indentation and naming conventions (camelCase for variables/functions).
- Ensure all new files include appropriate JSDoc comments.

## Questions?
If you have any questions or need clarification, feel free to open an **Issue** on the repository.

Happy coding!
