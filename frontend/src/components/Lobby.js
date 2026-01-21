import React, { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import Swal from 'sweetalert2';
import { Download, Upload, Copy, Wallet, Trash2, SquareMousePointer, RefreshCw, Coins, Users, DollarSign } from 'lucide-react';
import { ethers } from 'ethers';
import { pokerLobbyAddress, pokerLobbyABI, pokerChipsAddress, pokerChipsABI } from './Contracts';
import Utils from './Utils';
import 'react-tabs/style/react-tabs.css';
import './Lobby.css';

let provider = new ethers.JsonRpcProvider('https://sepolia.base.org');


const Lobby = () => {
  const [wallet, setWallet] = useState( {address: 'loading...' });
  const [balances, setBalances] = useState({ eth: 0, pkr: 0 });
  const [cashGames, setCashGames] = useState([]);
  const [sitAndGoGames, setSitAndGoGames] = useState([]);
  const [newGame, setNewGame] = useState({ gameType: "CASH", maxPlayers: 6, bigBlind: 2, token: "PKR", startingChips: 2000, buyIn: 10, blindDuration: 10, privateGame: false });

  const backupWallet = async () => {
    const virtualWallet = await Utils.loadWallet();
    prompt("Your Private Key", virtualWallet.privateKey);
  }

  const restoreWallet = async () => {
    if (await Swal.fire({ title: 'Restore Wallet?', text: "Make sure you have backed up your current wallet if it has any funds in it", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes' }).then(result => result.isConfirmed)) {
      const pk = prompt('Enter a private key');
      if (pk == '') return;
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

  const createWallet = async () => {
    const tmpWallet = ethers.Wallet.createRandom();
    const walletAddress = await tmpWallet.getAddress();
    const newWallet = { name: `Virtual Wallet 1`, privateKey: tmpWallet.privateKey, address: walletAddress, type: 'virtual' }
    const walletJSON = JSON.stringify(newWallet);
    localStorage.setItem('wallet', walletJSON);
    setWallet(walletJSON);
  }

  const connectWallet = async () => {
    if (await Swal.fire({ title: 'Are you sure?', text: "This will overwrite your virtual wallet and you'll need to confirm each transaction in metamask", icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes Connect' }).then(result => result.isConfirmed)) {
      provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();
      if (network.chainId !== 84532n) alert('Please set your network to Base Sepolia Testnet or visit Chainlist.org');
      const newWallet = { name: `Browser Wallet`, privateKey: null, address: signer.address, type: 'browser' }
      localStorage.setItem('wallet', JSON.stringify(newWallet));
        
      window.ethereum.on('accountsChanged', () => { connectWallet() });
      window.ethereum.on('network', () => { connectWallet() });
      setWallet(JSON.stringify(newWallet));
    }
  }
  
  const getWallet = () => {
    let walletJSON = localStorage.getItem('wallet');
    if (walletJSON === null) return 'Loading...';
    return JSON.parse(walletJSON);
  }

  const updateBalances = async () => {
    console.log('Updating balances...');
    try {
      const myWallet = getWallet();
      const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, provider);
      const eth = ethers.formatEther(await provider.getBalance(myWallet.address));
      const pkr = ethers.formatUnits(await pokerChips.balanceOf(myWallet.address), 6);
      setBalances({ eth, pkr });
    } catch (err) {
      console.log(err);
    }
  }

  const findGames = async () => {
    console.log('Finding games...');
    try {
      const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, provider);
      const latestCashGames = await pokerLobby.latestCashGames(10);
      const latestSitAndGoGames = await pokerLobby.latestSitAndGoGames(10);
      setCashGames(latestCashGames);
      setSitAndGoGames(latestSitAndGoGames)
    } catch (err) {
      console.log(err);
    }
  }

  const loadGame = async (gid) => {
    alert('coming soon');
    window.location = `/#/table?gid=0`;
  }

  const handleNewGameChange = (e) => {
    const { name, value } = e.target;
    setNewGame({
      ...newGame,
      [name]: value,
    });
  };



  const launchGame = async () => {
    console.log('Launching new game with settings:', newGame);
    let inviteKeys = {};
    if (newGame.privateGame === true) {
      inviteKeys.publicKey = '0x' + '0'.repeat(64);
    } else {
      inviteKeys = Utils.createKeyPair();
    }
    const bigBlind = ethers.parseUnits(newGame.bigBlind.toString(), 6);
    let buyIn = ethers.parseUnits((newGame.bigBlind * 100).toString(), 6);
    let gameId;
    if (newGame.gameType == 'SNG') buyIn = ethers.parseUnits(newGame.buyIn, 6);
    try {
        const virtualWallet = await Utils.loadWallet();
        const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, virtualWallet);
        let tx;
        if (newGame.gameType == 'CASH') {
          tx = await pokerLobby.createCashGame(newGame.maxPlayers, bigBlind, inviteKeys.publicKey, pokerChipsAddress);
        } else if (newGame.gameType == 'SNG') {
          tx = await pokerLobby.createSitAndGo(newGame.maxPlayers, bigBlind, newGame.blindDuration, newGame.startingChips, inviteKeys.publicKey, newGame.buyIn, pokerChipsAddress);
        }
        const receipt = await tx.wait();
        gameId = receipt.logs[1].args[0];
        if (newGame.privateGame === true) localStorage.setItem(`inviteKey_${gameId}`, inviteKeys.privateKey);
        if (await Swal.fire({ title: 'Join New Game?', text: "For the game to be displayed in the lobby it must have at least one player. Approve spend and then join the game", icon: 'success', showCancelButton: true, confirmButtonText: 'Yes' }).then(result => result.isConfirmed)) {
          const pokerChips = new ethers.Contract(pokerChipsAddress, pokerChipsABI, virtualWallet);
          await pokerChips.approve(await pokerLobbyAddress, buyIn);
          if (newGame.privateGame == true) {
            window.location = `/#/table?gid=${gameId}&inviteKey=${inviteKeys.privateKey}`;
          } else {
            window.location = `/#/table?gid=${gameId}`;
          }
          
        }
    } catch (error) {
        console.error("Failed to create game:", error);
    }
  }

  useEffect(() => {
    findGames();
    updateBalances();
  }, []);

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
          <table className="lobby-table">
            <thead>
                <tr>
                    <th>Game</th>
                    <th>Players</th>
                    <th>Blinds</th>
                    <th>Buy In</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Multideck Holdem</td>
                    <td>3/6</td>
                    <td>1/2</td>
                    <td>200 PKR</td>
                    <td><button onClick={() => loadGame(0)}>JOIN</button></td>
                </tr>
            </tbody>
          </table>
        </div>
      </TabPanel>
      <TabPanel>
        <div>
            <table className="lobby-table">
              <thead>
                  <tr>
                      <th>Game</th>
                      <th>Players</th>
                      <th>Blinds</th>
                      <th>Starting Chips</th>
                      <th>Blind Duration</th>
                      <th>Buy In</th>
                      <th>Actions</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>Multideck Holdem</td>
                      <td>1/6</td>
                      <td>10/20</td>
                      <td>2000</td>
                      <td>10 mins</td>
                      <td>100 PKR</td>
                      <td><button onClick={() => loadGame(0)}>JOIN</button></td>
                  </tr>
                  <tr>
                      <td>Multideck Holdem</td>
                      <td>2/3</td>
                      <td>1/2</td>
                      <td>5000</td>
                      <td>15 mins</td>
                      <td>50 PKR</td>
                      <td><button onClick={() => loadGame(0)}>JOIN</button></td>
                  </tr>
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
          <button className="flex-item" onClick={() => backupWallet()}><Download size={12} /> BACKUP</button>
          <button className="flex-item" onClick={() => restoreWallet()}><Upload size={12} /> RESTORE</button>
          <button className="flex-item" onClick={() => resetWallet()}><Trash2 size={12} /> RESET</button>
        </div>
        <div className="spacer"></div>
        <div className="flex-row flex-center">
          <button className="flex-item" onClick={() => connectWallet()}><SquareMousePointer size={12} /> CONNECT METAMASK</button>
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
      <button type="button" onClick={launchGame}>Launch New Game</button>
    </div>
  </div>
  );
}

export default Lobby;