import React, { useState, useEffect, useCallback } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Swal from 'sweetalert2';
import { Download, Upload, Copy, Wallet, Trash2, SquareMousePointer, RefreshCw, Coins } from 'lucide-react';
import { ethers } from 'ethers';
import { pokerLobbyAddress, pokerLobbyABI, pokerChipsAddress, pokerChipsABI } from './Contracts';
import Utils from './Utils';
import 'react-tabs/style/react-tabs.css';
import './Lobby.css';

const Lobby = () => {
  const [, setWallet] = useState( {address: 'loading...' });
  const [balances, setBalances] = useState({ eth: 0, pkr: 0 });
  const [cashGames, setCashGames] = useState([]);
  const [sitAndGoGames, setSitAndGoGames] = useState([]);
  const [newGame, setNewGame] = useState({ gameType: "CASH", maxPlayers: 6, bigBlind: 2, token: "PKR", startingChips: 2000, buyIn: 10, blindDuration: 10, privateGame: false });
  const [busyAction, setBusyAction] = useState('');
  const [rpcUrl, setRpcUrl] = useState(Utils.getRpcUrl());
  const ZERO_HASH = ethers.ZeroHash;

  const backupWallet = async () => {
    const { signer } = await Utils.loadWallet();
    if (signer?.privateKey) {
      prompt("Your Private Key", signer.privateKey);
    } else {
      Swal.fire({ title: 'No Private Key', text: 'This wallet is managed by MetaMask.', icon: 'info' });
    }
  }

  const restoreWallet = async () => {
    if (await Swal.fire({ title: 'Restore Wallet?', text: "Make sure you have backed up your current wallet if it has any funds in it", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes' }).then(result => result.isConfirmed)) {
      const pk = prompt('Enter a private key');
      if (pk === '') return;
      const tmpWallet = new ethers.Wallet(pk);
      const newWallet = { name: `Imported Wallet`, privateKey: tmpWallet.privateKey, address: tmpWallet.address, type: 'virtual' }
      localStorage.setItem('wallet', JSON.stringify(newWallet));
      setWallet(JSON.stringify(newWallet));
    }
  }

  const resetWallet = async () => {
    if (await Swal.fire({ title: 'Reset Wallet?', text: "Make sure you have backed up your current wallet if it has any funds in it", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes' }).then(result => result.isConfirmed)) {
      const tmpWallet = ethers.Wallet.createRandom();
      const newWallet = { name: `New Wallet`, privateKey: tmpWallet.privateKey, address: tmpWallet.address, type: 'virtual' }
      localStorage.setItem('wallet', JSON.stringify(newWallet));
      setWallet(JSON.stringify(newWallet));
    }
  }

  const connectWallet = async () => {
    if (await Swal.fire({ title: 'Are you sure?', text: "This will overwrite your virtual wallet and you'll need to confirm each transaction in metamask", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes Connect' }).then(result => result.isConfirmed)) {
      try {
        setBusyAction('connectWallet');
        await Utils.switchToBaseSepolia();
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const network = await provider.getNetwork();
        if (!Utils.isBaseSepolia(network.chainId)) alert('Please set your network to Base Sepolia Testnet or visit Chainlist.org');
        const newWallet = { name: 'Browser Wallet', privateKey: null, address: signer.address, type: 'browser' };
        localStorage.setItem('wallet', JSON.stringify(newWallet));
        window.ethereum.on('accountsChanged', () => { connectWallet() });
        window.ethereum.on('network', () => { connectWallet() });
        setWallet(JSON.stringify(newWallet));
      } catch (error) {
        console.error(error);
        Swal.fire({ title: 'Wallet Error', text: error?.message || 'Failed to connect wallet.', icon: 'error' });
      } finally {
        setBusyAction('');
      }
    }
  }
  
  const getWallet = useCallback(() => {
    let walletJSON = localStorage.getItem('wallet');
    if (walletJSON === null) return 'Loading...';
    return JSON.parse(walletJSON);
  }, []);

  const updateBalances = useCallback(async () => {
    console.log('Updating balances...');
    try {
      const myWallet = getWallet();
      const provider = Utils.getProvider();
      const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, provider);
      const eth = ethers.formatEther(await provider.getBalance(myWallet.address));
      const pkr = ethers.formatUnits(await pokerChips.balanceOf(myWallet.address), 6);
      setBalances({ eth, pkr });
    } catch (err) {
      console.log(err);
    }
  }, [getWallet]);

  const findGames = useCallback(async () => {
    console.log('Finding games...');
    try {
      const provider = Utils.getProvider();
      const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, provider);
      const latestCashGames = await pokerLobby.latestCashGames(10);
      const latestSitAndGoGames = await pokerLobby.latestSitAndGoGames(10);
      setCashGames(latestCashGames);
      setSitAndGoGames(latestSitAndGoGames)
    } catch (err) {
      console.log(err);
    }
  }, []);

  const handleNewGameChange = (e) => {
    const { name, value } = e.target;
    setNewGame({
      ...newGame,
      [name]: value,
    });
  };

  const handleRpcUrlChange = (e) => {
    setRpcUrl(e.target.value);
  };

  const saveRpcUrl = async () => {
    const trimmed = rpcUrl.trim();
    if (!trimmed) {
      Swal.fire({ title: 'RPC URL Required', text: 'Enter a valid Base Sepolia RPC URL.', icon: 'warning' });
      return;
    }
    try {
      setBusyAction('rpc');
      await Utils.testRpcUrl(trimmed);
      Utils.setRpcUrl(trimmed);
      Swal.fire({ title: 'RPC Saved', text: 'RPC endpoint updated. Reconnect MetaMask if it is using the old RPC.', icon: 'success' });
    } catch (error) {
      console.error(error);
      Swal.fire({ title: 'RPC Error', text: error?.message || 'Unable to reach that RPC endpoint.', icon: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const resetRpcUrl = () => {
    Utils.setRpcUrl('');
    setRpcUrl(Utils.getRpcUrl());
    Swal.fire({ title: 'RPC Reset', text: 'RPC endpoint reset to the default Base Sepolia RPC.', icon: 'success' });
  };

  const isPublicGame = (invitePublicKey) => {
    if (!invitePublicKey) return true;
    return invitePublicKey === ZERO_HASH;
  };

  const joinGame = async (game, gameType) => {
    const maxPlayers = Number(game.maxPlayers ?? 0);
    const seatOptions = Array.from({ length: maxPlayers }, (_, index) => (
      `<option value="${index}">${index}</option>`
    )).join('');
    const gameId = game.gid.toString();
    const savedInviteKey = localStorage.getItem(`inviteKey_${gameId}`) || '';
    const needsInvite = !isPublicGame(game.invitePublicKey);

    const { value: formValues } = await Swal.fire({
      title: `Join Game #${gameId}`,
      html: `
        <div style="text-align:left">
          <label for="join-seat">Seat</label>
          <select id="join-seat" class="swal2-input">${seatOptions}</select>
          <label for="join-invite">Invite Key (private games only)</label>
          <input id="join-invite" class="swal2-input" placeholder="0x..." value="${savedInviteKey}">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Approve + Join',
      preConfirm: () => {
        const seat = document.getElementById('join-seat').value;
        const inviteKey = document.getElementById('join-invite').value.trim();
        return { seat, inviteKey };
      },
    });

    if (!formValues) return;
    if (needsInvite && !formValues.inviteKey) {
      Swal.fire({ title: 'Invite Key Required', text: 'This game is private. Paste the invite key to join.', icon: 'error' });
      return;
    }

    try {
      setBusyAction('join');
      Swal.fire({ title: 'Joining game...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const { signer, wallet } = await Utils.loadWallet();
      const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, signer);
      const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, signer);
      const handKeys = Utils.ensureHandKeys(gameId);
      const invitePrivateKey = needsInvite ? formValues.inviteKey : ZERO_HASH;
      const buyIn = gameType === 'SNG' ? (game.buyIn ?? 0n) : (game.bigBlind * 100n);

      const allowance = await pokerChips.allowance(wallet.address, pokerLobbyAddress);
      if (allowance < buyIn) {
        const allowanceText = ethers.formatUnits(allowance, 6);
        const buyInText = ethers.formatUnits(buyIn, 6);
        const approvalConfirm = await Swal.fire({
          title: 'Approve PokerChips?',
          html: `Required buy-in: <b>${buyInText} PKR</b><br/>Current allowance: <b>${allowanceText} PKR</b>`,
          icon: 'info',
          showCancelButton: true,
          confirmButtonText: 'Approve',
        });
        if (!approvalConfirm.isConfirmed) return;
        await pokerChips.approve(pokerLobbyAddress, buyIn);
      }
      if (gameType === 'SNG') {
        await pokerLobby.registerSitAndGo(game.gid, Number(formValues.seat), handKeys.currentPublicKey, invitePrivateKey);
      } else {
        await pokerLobby.joinCashGame(game.gid, Number(formValues.seat), handKeys.currentPublicKey, invitePrivateKey);
      }
      if (needsInvite && formValues.inviteKey) localStorage.setItem(`inviteKey_${gameId}`, formValues.inviteKey);
      Swal.close();
      Swal.fire({ title: 'Joined', text: 'You have joined the game. Loading table...', icon: 'success' });
      window.location = `/#/table?gid=${gameId}`;
    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire({ title: 'Join Failed', text: error?.reason || error?.message || 'Transaction failed.', icon: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const mintTestChips = async () => {
    try {
      setBusyAction('mint');
      const { signer } = await Utils.loadWallet();
      const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, signer);
      const mintAmount = ethers.parseUnits('10000', 6);
      await pokerChips.mint(mintAmount);
      await updateBalances();
      Swal.fire({ title: 'Minted', text: '10,000 PKR added to your wallet.', icon: 'success' });
    } catch (error) {
      console.error(error);
      Swal.fire({ title: 'Mint Failed', text: error?.reason || error?.message || 'Unable to mint test chips.', icon: 'error' });
    } finally {
      setBusyAction('');
    }
  };

  const formatBlinds = (bigBlind) => {
    if (bigBlind === undefined || bigBlind === null) return '-';
    const smallBlind = bigBlind / 2n;
    return `${ethers.formatUnits(smallBlind, 6)}/${ethers.formatUnits(bigBlind, 6)}`;
  };

  const formatBuyIn = (bigBlind) => {
    if (bigBlind === undefined || bigBlind === null) return '-';
    return ethers.formatUnits(bigBlind * 100n, 6);
  };


  const launchGame = async () => {
    console.log('Launching new game with settings:', newGame);
    setBusyAction('launch');
    let inviteKeys = {};
    if (newGame.privateGame === true) {
      inviteKeys.publicKey = '0x' + '0'.repeat(64);
    } else {
      inviteKeys = Utils.createKeyPair();
    }
    const bigBlind = ethers.parseUnits(newGame.bigBlind.toString(), 6);
    let buyIn = ethers.parseUnits((newGame.bigBlind * 100).toString(), 6);
    let gameId;
    if (newGame.gameType === 'SNG') buyIn = ethers.parseUnits(newGame.buyIn, 6);
    try {
        const { signer } = await Utils.loadWallet();
        const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, signer);
        let tx;
        if (newGame.gameType === 'CASH') {
          tx = await pokerLobby.createCashGame(newGame.maxPlayers, bigBlind, inviteKeys.publicKey, pokerChipsAddress);
        } else if (newGame.gameType === 'SNG') {
          tx = await pokerLobby.createSitAndGo(newGame.maxPlayers, bigBlind, newGame.blindDuration, newGame.startingChips, inviteKeys.publicKey, newGame.buyIn, pokerChipsAddress);
        }
        const receipt = await tx.wait();
        gameId = receipt.logs[1].args[0];
        const gameIdString = gameId.toString();
        if (newGame.privateGame === true) localStorage.setItem(`inviteKey_${gameIdString}`, inviteKeys.privateKey);
        if (await Swal.fire({ title: 'Join New Game?', text: "For the game to be displayed in the lobby it must have at least one player. Approve spend and then join the game", icon: 'success', showCancelButton: true, confirmButtonText: 'Yes' }).then(result => result.isConfirmed)) {
          const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, signer);
          await pokerChips.approve(await pokerLobbyAddress, buyIn);
          if (newGame.privateGame === true) {
            window.location = `/#/table?gid=${gameIdString}&inviteKey=${inviteKeys.privateKey}`;
          } else {
            window.location = `/#/table?gid=${gameIdString}`;
          }
          
        }
    } catch (error) {
        console.error("Failed to create game:", error);
        const rpcHint = Utils.getRpcErrorHint(error);
        Swal.fire({ title: 'Create Game Failed', text: rpcHint || error?.reason || error?.message || 'Unable to create game.', icon: 'error' });
    } finally {
        setBusyAction('');
    }
  }

  useEffect(() => {
    findGames();
    updateBalances();
    const interval = setInterval(() => {
      findGames();
    }, 15000);
    return () => clearInterval(interval);
  }, [findGames, updateBalances]);

  return (
  <div className="content">
    <div className="rotate-notice">
      <div>
        <div className="logo">Decent<span className="grey">Poker</span></div>
        <p>Please rotate your device to landscape mode</p>
      </div>
    </div>
    <div className="header pointer" onClick={() => window.location = '/'}>
      <div className="logo">Decent<span className="grey">Poker</span></div>
    </div>
    <h1>&#9827; Welcome To The Lobby &#9824;</h1>
    <Tabs>
      <TabList>
        <Tab>Cash Games</Tab>
        <Tab>Sit &amp; Go</Tab>
        <Tab>Wallet Management</Tab>
      </TabList>

      <TabPanel>
        <div>
          <div className="flex-row flex-center">
            <button type="button" onClick={() => findGames()} disabled={busyAction !== ''}>Refresh Games</button>
          </div>
          <table className="lobby-table">
            <thead>
                <tr>
                    <th>Game</th>
                    <th>Players</th>
                    <th>Blinds</th>
                    <th>Buy In</th>
                    <th>Access</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {cashGames.filter((game) => game.gid && game.gid > 0n).map((game) => (
                  <tr key={game.gid.toString()}>
                    <td>Multideck Holdem #{game.gid.toString()}</td>
                    <td>{game.activePlayers?.toString?.() ?? game.activePlayers}/{game.maxPlayers?.toString?.() ?? game.maxPlayers}</td>
                    <td>{formatBlinds(game.bigBlind)}</td>
                    <td>{formatBuyIn(game.bigBlind)} PKR</td>
                    <td>{isPublicGame(game.invitePublicKey) ? 'Public' : 'Private'}</td>
                    <td><button onClick={() => joinGame(game, 'CASH')} disabled={busyAction === 'join'}>JOIN</button></td>
                  </tr>
                ))}
                {cashGames.filter((game) => game.gid && game.gid > 0n).length === 0 && (
                  <tr>
                    <td colSpan="6">No active cash games found.</td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </TabPanel>
      <TabPanel>
        <div>
            <div className="flex-row flex-center">
              <button type="button" onClick={() => findGames()} disabled={busyAction !== ''}>Refresh Games</button>
            </div>
            <table className="lobby-table">
              <thead>
                  <tr>
                      <th>Game</th>
                      <th>Players</th>
                      <th>Blinds</th>
                      <th>Starting Chips</th>
                      <th>Blind Duration</th>
                      <th>Buy In</th>
                      <th>Access</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody>
                  {sitAndGoGames.filter((game) => game.gid && game.gid > 0n).map((game) => (
                    <tr key={game.gid.toString()}>
                      <td>Multideck Sit &amp; Go #{game.gid.toString()}</td>
                      <td>{game.activePlayers?.toString?.() ?? game.activePlayers}/{game.maxPlayers?.toString?.() ?? game.maxPlayers}</td>
                      <td>{formatBlinds(game.bigBlind)}</td>
                      <td>{game.startingChips?.toString?.() ?? game.startingChips}</td>
                      <td>{game.blindDuration?.toString?.() ?? game.blindDuration} mins</td>
                      <td>{ethers.formatUnits(game.buyIn ?? 0n, 6)} PKR</td>
                      <td>{isPublicGame(game.invitePublicKey) ? 'Public' : 'Private'}</td>
                      <td><button onClick={() => joinGame(game, 'SNG')} disabled={busyAction === 'join'}>JOIN</button></td>
                    </tr>
                  ))}
                  {sitAndGoGames.filter((game) => game.gid && game.gid > 0n).length === 0 && (
                    <tr>
                      <td colSpan="8">No active sit &amp; go games found.</td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
      </TabPanel>
      <TabPanel>
        <div>
          <div className="text-big green">DecentPoker is best played with a burner virtual wallet</div>
          <p>Please note that DecentPoker is currently deployed to Base Sepolia testnet.</p>
          <p>You will need some testnet ETH to pay transaction fees in your wallet.</p>
        </div>
        <div className="flex-row flex-middle wallet-container">
          <div className="flex-item">
            <div id="wallet-name" className="text-big"><Wallet size={12} /> {getWallet().name}</div>
          </div>
          <div className="flex-item flex-grow">
            <div className="text-big green">Connected</div>
            <div className="text-small grey">{getWallet().type}</div>
          </div>
          <div className="flex-row flex-middle flex-center pointer" onClick={() => Utils.copyToClipBoard('wallet-address')}>
            <span id="wallet-address" className="text-small purple">{getWallet().address}</span>
            &nbsp; <Copy className="green" size={12} />
          </div>
        </div>
        <RefreshCw id="refresh-balances" className="green pointer" size={16} onClick={() => updateBalances()} />
        <table className="asset-table">
          <thead>
            <tr>
              <th>ASSET</th>
              <th>BALANCE</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ETH</td>
              <td><span className="green" id="eth-balance">{balances.eth}</span> <span className="text-small grey">ETH</span></td>
            </tr>
            <tr>
              <td>PokerChips</td>
              <td><span className="green" id="pokerchips-balance">{balances.pkr}</span> <span className="text-small grey">PKR</span></td>
            </tr>
          </tbody>
        </table>

        <div className="flex-row flex-center">
          <button className="flex-item" onClick={() => backupWallet()} disabled={busyAction !== ''}><Download size={12} /> BACKUP</button>
          <button className="flex-item" onClick={() => restoreWallet()} disabled={busyAction !== ''}><Upload size={12} /> RESTORE</button>
          <button className="flex-item" onClick={() => resetWallet()} disabled={busyAction !== ''}><Trash2 size={12} /> RESET</button>
        </div>
        <div className="flex-row flex-center">
          <button className="flex-item" onClick={() => mintTestChips()} disabled={busyAction === 'mint'}><Coins size={12} /> MINT TEST CHIPS</button>
        </div>
        <div className="spacer"></div>
        <div className="flex-row flex-center">
          <button className="flex-item" onClick={() => connectWallet()} disabled={busyAction === 'connectWallet'}><SquareMousePointer size={12} /> CONNECT METAMASK</button>
        </div>
        <div className="wallet-settings">
          <div className="text-big">RPC Settings</div>
          <p className="text-small grey">Used for Base Sepolia reads and when adding the network to MetaMask.</p>
          <div className="form-group">
            <label>Base Sepolia RPC URL</label>
            <input type="text" value={rpcUrl} onChange={handleRpcUrlChange} placeholder="https://..." />
          </div>
          <div className="flex-row flex-center">
            <button className="flex-item" onClick={saveRpcUrl} disabled={busyAction === 'rpc'}>SAVE RPC</button>
            <button className="flex-item" onClick={resetRpcUrl} disabled={busyAction !== ''}>RESET</button>
          </div>
        </div>
        <div id="wallet-assets" className="flex-column"></div>
      </TabPanel>
    </Tabs>
    <div className="new-game">
      <p className="green">Launch New Table</p>
      <div className="form-group">
        <label>Game Type:</label>
        <select name="gameType" value={newGame.gameType} onChange={handleNewGameChange}>
          <option value="CASH">Multideck Cash Game</option>
          <option value="SNG">Multideck Sit &amp; Go</option>
        </select>
      </div>
      <div className="form-group">
        <label>Max Players: {newGame.maxPlayers}</label>
        <input type="range" min="2" max="6" name="maxPlayers" value={newGame.maxPlayers} onChange={handleNewGameChange} />
      </div>
      <div className="form-group">
        <label>Big Blind: </label>
        <input type="number" min="0.02" max="99999999" step="0.01" name="bigBlind" value={newGame.bigBlind} onChange={handleNewGameChange} />
      </div>
      {newGame.gameType === "SNG" ? (
        <div>
          <div className="form-group">
            <label>Starting Chips: </label>
            <input type="number" min="100" max="99999999" step="1" name="startingChips" value={newGame.startingChips} onChange={handleNewGameChange} />
          </div>
          <div className="form-group">
            <label>Blilnd Duration (mins): </label>
            <input type="number" min="1" max="99999999" step="1" name="blindDuration" value={newGame.blindDuration} onChange={handleNewGameChange} />
          </div>
          <div className="form-group">
            <label>Buy In: </label>
            <input type="number" min="0.01" max="99999999" step="1" name="buyIn" value={newGame.buyIn} onChange={handleNewGameChange} />
          </div>
        </div>
      ) : (
        <div></div>
      )}
      <div className="form-group">
        <label>Token:</label>
        <select name="token" value={newGame.token} onChange={handleNewGameChange}>
          <option value="PKR">PKR</option>
          <option value="ETH" disabled>ETH</option>
          <option value="USDC" disabled>USDC</option>
          <option value="USDT" disabled>USDT</option>
        </select>
      </div>
      <p className="text-small">PKR is a free testnet poker chip</p>
      <div className="form-group">
        <label>Private Game: </label>
        <input type="checkbox" value={newGame.privateGame} name="privateGame" onChange={handleNewGameChange} />
      </div>
      <button type="button" onClick={launchGame} disabled={busyAction === 'launch'}>Launch New Game</button>
    </div>
  </div>
  );
}

export default Lobby;
