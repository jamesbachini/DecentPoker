1. Centralize network + wallet handling for the frontend.
   - Create a small config module (e.g., `frontend/src/components/config.js`) that holds the Base Sepolia RPC URL, chainId `84532`, and the deployed contract addresses currently in `frontend/src/components/Contracts.js`.
   - Update `frontend/src/components/Utils.js` so `loadWallet()` always uses the Base Sepolia RPC (not `ethers.getDefaultProvider()`), and can return both a `provider` and a `signer` consistently. Include a helper to switch MetaMask to Base Sepolia (using `wallet_switchEthereumChain`) and show a clear error when MetaMask is missing.
   - Ensure every contract call uses the shared provider/signer (no duplicate `new JsonRpcProvider` scattered in components). Fix any BigInt/string mismatches when comparing `gid` or chainId.

2. Replace static lobby tables with real on-chain game listings.
   - In `frontend/src/components/Lobby.js`, render `cashGames` and `sitAndGoGames` returned by `latestCashGames`/`latestSitAndGoGames` instead of the hardcoded rows.
   - Display: game id, players (active/max), blinds, buy-in/starting chips, and whether the game is public or private.
   - Add refresh/polling (e.g., every 10–15s) and a manual refresh button.

3. Implement the join flow with seat selection and invite keys.
   - Add a join modal or inline controls to pick a seat (0..maxPlayers-1) and optionally paste an invite code for private games.
   - For cash games: call `pokerLobby.joinCashGame(gid, seat, handPublicKey, invitePrivateKey)` after approving `PokerChips` for the buy-in (`bigBlind * 100`).
   - For sit & go: call `registerSitAndGo` with the same key handling and buy-in approval.
   - Persist private invite keys in `localStorage` when you create a private game so the creator can rejoin easily.

4. Build the live table state model and render it.
   - In `frontend/src/components/Table.js`, fetch `games(gid)` and all `getPlayer(gid, seat)` entries, then map them onto the existing seat DOM nodes (`#seat1-player` ... `#seat6-player`).
   - Show player address (or a short form), chip stacks, current bets, folded status, dealer button, and action-on seat highlight.
   - Display pot total, blinds, and game state (Waiting/PreFlop/Flop/Turn/River/Showdown).

5. Wire up game events + periodic refresh.
   - Subscribe to `PokerGame` and `PokerDealer` events (`PlayerJoined`, `NewHand`, `NewRound`, `Action`, `Winner`, `Flop`, `Turn`, `River`, `HandClosed`) and refresh table state when they fire.
   - Make sure event listeners are cleaned up on unmount.
   - Use a small interval (e.g., 5–10s) to re-fetch state in case events are missed.

6. Implement card rendering and hand key management.
   - Create a helper that maps card ids (1–52) to SVG filenames in `frontend/public/img/cards` using the contract mapping: value = `(card-1)%13 + 2`, suit = `(card-1)/13` (use suits order hearts, diamonds, clubs, spades unless you find a better match). Map 10 to `T`, 11–14 to `JQKA`.
   - Show community cards from `pokerDealer.getFlop/Turn/River` and hole cards for the local player using `pokerDealer.getCards(hid, privateKey)`.
   - Store per-game hand keys in `localStorage` (`currentPrivateKey/currentPublicKey` + `nextPrivateKey/nextPublicKey`); rotate keys when calling `revealHand`.

7. Finish the action controls (fold/check/call/raise, deal, leave).
   - Re-enable the action UI in `Table.js` (currently commented). Show only actions valid for the local player and current game state.
   - Implement `playerAction(gid, action, amount)` with the correct enum values: Fold=0, Check=1, Call=2, Raise=3. For raises, pass the total bet amount (not the delta) and enforce max = currentBet + chips.
   - Add a “Deal Hand” button when the game is in Waiting and has >=2 active players.
   - Add “Leave Table” and “Auto Fold” controls wired to `leaveGame` and `autoFold`.

8. Sit & Go progression and blinds.
   - Display SNG metadata: start time, blind duration, next blind level.
   - If the blind timer is due, surface a button that calls `pokerLobby.updateBlinds(gid)` (and update the table state after success).

9. Add faucet + approval UX for PokerChips.
   - Provide a “Mint Test Chips” button in the lobby wallet tab that calls `pokerChips.mint` with a safe default (e.g., 1,000 or 10,000 PKR).
   - Show allowance vs required buy-in when joining a game and offer a one-click “Approve” flow.

10. Polish + QA pass.
   - Add consistent loading/error states for async calls and transactions (e.g., disable buttons while tx pending, surface errors with SweetAlert).
   - Verify flows manually: create game, join with virtual wallet, deal hand, act, reveal hand, and leave.
   - Ensure build output still succeeds with `cd frontend && npm run build`.
