# Repository Guidelines

## Project Structure & Module Organization
- `contracts/`: Solidity smart contracts (e.g., `PokerGame.sol`, `PokerDealer.sol`, `PokerLobby.sol`).
- `test/`: Hardhat tests in JS, typically named `0xNN-Feature.js`.
- `scripts/`: deployment and utility scripts (e.g., `deploy-testnet.js`).
- `frontend/`: React app (`frontend/src`, `frontend/public`); build output targets `docs/`.
- `docs/`: static site assets and frontend build output.
- `artifacts/`, `cache/`: Hardhat build outputs (generated).

## Build, Test, and Development Commands
- `npm install` (repo root): install Hardhat and contract dependencies.
- `npx hardhat compile`: compile Solidity contracts.
- `npx hardhat test`: run the contract test suite.
- `npx hardhat run scripts/deploy-testnet.js --network baseSepolia`: deploy to Base Sepolia (requires `.env`).
- `cd frontend && npm install`: install frontend dependencies.
- `cd frontend && npm start`: run the React dev server.
- `cd frontend && npm run build`: build frontend into `docs/` for static hosting.
- `cd frontend && npm test`: run frontend tests (React Testing Library).

## Coding Style & Naming Conventions
- Solidity: 4-space indentation, braces on the same line; keep contract-specific interfaces near the top of the file.
- JavaScript: 4-space indentation in scripts/tests; `camelCase` for variables/functions.
- React: `PascalCase` components; keep UI assets under `frontend/public` and logic in `frontend/src`.
- Filenames: `PascalCase.sol` for contracts, `0xNN-Name.js` for tests.

## Testing Guidelines
- Smart contracts use Hardhat (Mocha/Chai under `@nomicfoundation/hardhat-toolbox`).
- Add or extend tests when changing contract logic; follow the `0xNN-Feature.js` naming pattern.
- Frontend tests are optional but preferred for UI/logic changes; run from `frontend/`.

## Commit & Pull Request Guidelines
- Recent commits use short, descriptive summaries (no strict convention). Keep commit titles concise and scoped.
- PRs should include: summary of changes, tests run, and any deployment notes or addresses.
- Coordinate with core devs before significant work (per README).

## Security & Configuration
- `.env` is required for network keys (e.g., `ALCHEMY_API_KEY`, `PRIVATE_KEY`, `BASESCAN_API_KEY`).
- Never commit secrets; use testnet keys only for local/dev workflows.
