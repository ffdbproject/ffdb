# Contributing to FFDB

Thank you for considering contributing to the Flora and Fauna Database of Bangladesh! Every contribution helps us build a better biodiversity resource.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/ffdbproject/ffdb/issues)
2. If not, open a new issue with:
   - A clear title and description
   - Steps to reproduce the bug
   - Expected vs. actual behavior
   - Browser and OS information
   - Screenshots if applicable

### Suggesting Features

Open an issue with the `enhancement` label and describe:
- The problem your feature would solve
- How you envision it working
- Any alternatives you've considered

### Submitting Code

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your change: `git checkout -b feature/my-feature`
4. **Make your changes** — follow the code style of the existing codebase
5. **Test your changes** — make sure nothing is broken
6. **Commit** with a clear message: `git commit -m "Add: species export as CSV"`
7. **Push** to your fork: `git push origin feature/my-feature`
8. **Open a Pull Request** against the `main` branch

### Adding Species Data

You can contribute species data in two ways:
- **Via the website**: Use the [Contribute page](https://ffdb.bd/contribute)
- **Via Pull Request**: Add species JSON data directly

## Code Style Guidelines

- **JavaScript**: Use modern ES6+ syntax
- **React**: Functional components with hooks
- **CSS**: Use the existing design token system (`tokens.css`)
- **Naming**: Use descriptive variable and function names
- **Comments**: Add comments for non-obvious logic

## Testing Your Changes

```bash
# Run the frontend build to check for errors
cd frontend
npm run build

# Run the backend to verify API endpoints
cd backend
npm run dev
```

## License

By contributing, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0.
