import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { pokerGameAddress, pokerGameABI, pokerDealerAddress, pokerDealerABI, pokerLobbyAddress, pokerLobbyABI } from './Contracts';
import { ethers } from 'ethers';
import Utils from './Utils';
import './Table.css';

const Table = () => {
  const [tableState, setTableState] = useState({ potTotal: 0n, bigBlind: 0n, maxPlayers: 0, dealerSeat: 0, actionOnSeat: 0, state: 0, hid: 0n, currentBet: 0n });
  const [players, setPlayers] = useState([]);
  const [communityCards, setCommunityCards] = useState([]);
  const [holeCards, setHoleCards] = useState([]);
  const [localSeatIndex, setLocalSeatIndex] = useState(null);
  const [raiseTo, setRaiseTo] = useState('');
  const [sngMeta, setSngMeta] = useState(null);
  const [isTxPending, setIsTxPending] = useState(false);
  const [notification, setNotification] = useState('Loading...');

  const [searchParams] = useSearchParams();
  const gidParam = searchParams.get('gid');
  if (!gidParam) window.location = '/#/lobby';
  const gid = gidParam ? ethers.toBigInt(gidParam) : null;

  const seatIds = useMemo(() => [1, 2, 3, 4, 5, 6], []);
  const gameStates = ['Waiting', 'PreFlop', 'Flop', 'Turn', 'River', 'Showdown'];

  const shortAddress = (address) => {
    if (!address || address === ethers.ZeroAddress) return 'Empty Seat';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const normalizePlayer = (player) => {
    if (!player) return null;
    const addr = player.addr ?? player.address ?? player[0];
    const chips = player.chips ?? player[1] ?? 0n;
    const currentBet = player.currentBet ?? player[2] ?? 0n;
    const hasFolded = player.hasFolded ?? player[3] ?? false;
    const hasActed = player.hasActed ?? player[4] ?? false;
    const handPublicKey = player.handPublicKey ?? player[5];
    const handPrivateKey = player.handPrivateKey ?? player[6];
    return { addr, chips, currentBet, hasFolded, hasActed, handPublicKey, handPrivateKey };
  };

  const getStoredWalletAddress = () => {
    try {
      const walletJSON = localStorage.getItem('wallet');
      if (!walletJSON) return null;
      const wallet = JSON.parse(walletJSON);
      return wallet?.address?.toLowerCase() ?? null;
    } catch (error) {
      return null;
    }
  };

  const normalizeCardId = (card) => {
    if (card === undefined || card === null) return 0;
    return Number(card);
  };

  const cardIdToFilename = (cardId) => {
    const id = normalizeCardId(cardId);
    if (!id || Number.isNaN(id)) return null;
    const value = ((id - 1) % 13) + 2;
    const suitIndex = Math.floor((id - 1) / 13);
    const suits = ['h', 'd', 'c', 's'];
    const faceValues = { 10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
    const valueText = faceValues[value] || value.toString();
    const suit = suits[suitIndex];
    if (!suit) return null;
    return `${valueText}${suit}.svg`;
  };

  const loadCards = useCallback(async (handId, localPrivateKey) => {
    if (!handId || handId === 0n) {
      setCommunityCards([]);
      setHoleCards([]);
      return;
    }
    const provider = Utils.getProvider();
    const pokerDealer = new ethers.Contract(pokerDealerAddress, pokerDealerABI, provider);
    try {
      const [flop1, flop2, flop3] = await pokerDealer.getFlop(handId);
      const turn = await pokerDealer.getTurn(handId);
      const river = await pokerDealer.getRiver(handId);
      const nextCommunity = [flop1, flop2, flop3, turn, river]
        .map(normalizeCardId)
        .filter((card) => card > 0);
      setCommunityCards(nextCommunity);
    } catch (error) {
      console.error(error);
      setCommunityCards([]);
    }

    if (!localPrivateKey) {
      setHoleCards([]);
      return;
    }

    try {
      const cards = await pokerDealer.getCards(handId, localPrivateKey);
      const nextHoleCards = cards
        .slice(0, 2)
        .map(normalizeCardId)
        .filter((card) => card > 0);
      setHoleCards(nextHoleCards);
    } catch (error) {
      console.error(error);
      setHoleCards([]);
    }
  }, []);

  const loadSitAndGoMeta = useCallback(async () => {
    if (gid === null) return;
    const provider = Utils.getProvider();
    const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, provider);
    try {
      const sng = await pokerLobby.sitAndGos(gid);
      const bigBlind = sng.bigBlind ?? 0n;
      if (!bigBlind || bigBlind === 0n) {
        setSngMeta(null);
        return;
      }
      const nextBlind = await pokerLobby.findNextBlind(bigBlind);
      setSngMeta({
        gid: sng.gid ?? gid,
        bigBlind,
        blindDuration: sng.blindDuration ?? 0n,
        lastBlindUpdate: sng.lastBlindUpdate ?? 0n,
        startTimestamp: sng.startTimestamp ?? 0n,
        nextBlind: nextBlind ?? 0n,
      });
    } catch (error) {
      console.error(error);
      setSngMeta(null);
    }
  }, [gid]);

  const loadTable = useCallback(async() => {
    if (gid === null) return;
    const provider = Utils.getProvider();
    const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, provider);
    const game = await pokerGame.games(gid);
    const maxPlayers = Number(game.maxPlayers ?? 0);
    const blindsText = `${ethers.formatUnits(game.bigBlind / 2n, 6)}/${ethers.formatUnits(game.bigBlind, 6)}`;
    setNotification(`Game ID ${gid}, Max Players: ${maxPlayers}, Blinds: ${blindsText}`);
    setTableState({
      potTotal: game.potTotal ?? 0n,
      bigBlind: game.bigBlind ?? 0n,
      maxPlayers,
      dealerSeat: Number(game.dealerSeat ?? 0),
      actionOnSeat: Number(game.actionOnSeat ?? 0),
      state: Number(game.state ?? 0),
      hid: game.hid ?? 0n,
      currentBet: game.currentBet ?? 0n,
    });

    const nextPlayers = Array.from({ length: 6 }, (_, index) => ({
      seatIndex: index,
      addr: ethers.ZeroAddress,
      chips: 0n,
      currentBet: 0n,
      hasFolded: false,
      hasActed: false,
      outOfRange: index >= maxPlayers,
    }));

    const seatsToFetch = Math.min(maxPlayers, 6);
    for (let seat = 0; seat < seatsToFetch; seat++) {
      const player = normalizePlayer(await pokerGame.getPlayer(gid, seat));
      if (!player) continue;
      nextPlayers[seat] = {
        seatIndex: seat,
        ...player,
        outOfRange: false,
      };
    }
    setPlayers(nextPlayers);
    const walletAddress = getStoredWalletAddress();
    if (walletAddress) {
      const foundSeat = nextPlayers.findIndex((player) => player.addr?.toLowerCase?.() === walletAddress);
      setLocalSeatIndex(foundSeat >= 0 ? foundSeat : null);
      const handKeys = Utils.getHandKeys(gid);
      const localPrivateKey = foundSeat >= 0 ? handKeys?.currentPrivateKey : null;
      await loadCards(game.hid ?? 0n, localPrivateKey);
    } else {
      setLocalSeatIndex(null);
      await loadCards(game.hid ?? 0n, null);
    }
    await loadSitAndGoMeta();
  }, [gid, loadCards, loadSitAndGoMeta]);

  const activePlayers = useMemo(() => players.filter((player) => player && player.addr !== ethers.ZeroAddress && !player.outOfRange).length, [players]);
  const localPlayer = localSeatIndex !== null && localSeatIndex >= 0 ? players[localSeatIndex] : null;
  const isMyTurn = localPlayer && !localPlayer.outOfRange && localSeatIndex === tableState.actionOnSeat && tableState.state !== 0 && !localPlayer.hasFolded;
  const canCheck = isMyTurn && (localPlayer?.currentBet ?? 0n) === (tableState.currentBet ?? 0n);
  const canCall = isMyTurn && (localPlayer?.currentBet ?? 0n) < (tableState.currentBet ?? 0n) && (localPlayer?.chips ?? 0n) > 0n;
  const canRaise = isMyTurn && (localPlayer?.chips ?? 0n) > 0n;
  const canFold = isMyTurn;
  const maxRaiseTo = (tableState.currentBet ?? 0n) + (localPlayer?.chips ?? 0n);
  const minRaiseTo = (tableState.currentBet ?? 0n) + (tableState.bigBlind ?? 0n);

  useEffect(() => {
    if (!localPlayer) return;
    if (!canRaise) return;
    const defaultRaise = minRaiseTo > maxRaiseTo ? maxRaiseTo : minRaiseTo;
    if (defaultRaise > 0n) setRaiseTo(ethers.formatUnits(defaultRaise, 6));
  }, [localSeatIndex, localPlayer, tableState.currentBet, tableState.bigBlind, maxRaiseTo, minRaiseTo, canRaise]);

  const runTx = async (label, txFn) => {
    if (isTxPending) return;
    try {
      setIsTxPending(true);
      Swal.fire({ title: label, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await txFn();
      Swal.close();
    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire({ title: 'Transaction Failed', text: error?.reason || error?.message || 'Transaction failed.', icon: 'error' });
      throw error;
    } finally {
      setIsTxPending(false);
    }
  };

  const handlePlayerAction = async (action, amount = 0n) => {
    try {
      await runTx('Submitting action...', async () => {
        const { signer } = await Utils.loadWallet();
        const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, signer);
        await pokerGame.playerAction(gid, action, amount);
      });
      loadTable();
    } catch (error) {
      setNotification(error?.reason || error?.message || 'Action failed');
    }
  };

  const handleRaise = async () => {
    try {
      const raiseAmount = raiseTo ? ethers.parseUnits(raiseTo.toString(), 6) : 0n;
      if (raiseAmount <= (tableState.currentBet ?? 0n)) {
        setNotification('Raise must be greater than current bet.');
        return;
      }
      if (raiseAmount > maxRaiseTo) {
        setNotification('Raise exceeds your available chips.');
        return;
      }
      await handlePlayerAction(3, raiseAmount);
    } catch (error) {
      console.error(error);
      setNotification('Invalid raise amount.');
    }
  };

  const handleDealHand = async () => {
    try {
      await runTx('Dealing hand...', async () => {
        const { signer } = await Utils.loadWallet();
        const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, signer);
        await pokerGame.dealHand(gid);
      });
      loadTable();
    } catch (error) {
      setNotification(error?.reason || error?.message || 'Failed to deal hand.');
    }
  };

  const handleLeaveGame = async () => {
    try {
      await runTx('Leaving table...', async () => {
        const { signer } = await Utils.loadWallet();
        const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, signer);
        await pokerGame.leaveGame(gid);
      });
      window.location = '/#/lobby';
    } catch (error) {
      setNotification(error?.reason || error?.message || 'Failed to leave table.');
    }
  };

  const handleAutoFold = async () => {
    try {
      await runTx('Auto folding...', async () => {
        const { signer } = await Utils.loadWallet();
        const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, signer);
        await pokerGame.autoFold(gid);
      });
      loadTable();
    } catch (error) {
      setNotification(error?.reason || error?.message || 'Auto fold failed.');
    }
  };

  const handleUpdateBlinds = async () => {
    try {
      await runTx('Updating blinds...', async () => {
        const { signer } = await Utils.loadWallet();
        const pokerLobby = new ethers.Contract(pokerLobbyAddress, pokerLobbyABI, signer);
        await pokerLobby.updateBlinds(gid);
      });
      await loadTable();
    } catch (error) {
      setNotification(error?.reason || error?.message || 'Failed to update blinds.');
    }
  };

  useEffect(() => {
    if (gid === null) return;
    loadTable();

    const provider = Utils.getProvider();
    const pokerGame = new ethers.Contract(pokerGameAddress, pokerGameABI, provider);
    const pokerDealer = new ethers.Contract(pokerDealerAddress, pokerDealerABI, provider);

    const isSameGame = (eventGid) => {
      try {
        return ethers.toBigInt(eventGid) === gid;
      } catch (error) {
        return false;
      }
    };

    const handlePlayerJoined = (gameId, player, seatIndex) => {
      if (!isSameGame(gameId)) return;
      setNotification(`${player} joined the game on seat ${seatIndex}`);
      loadTable();
    };
    const handleNewHand = (gameId, hid) => {
      if (!isSameGame(gameId)) return;
      setNotification(`New hand started with ID ${hid}`);
      loadTable();
    };
    const handleNewRound = (gameId, state) => {
      if (!isSameGame(gameId)) return;
      setNotification(`New round started, state: ${state}`);
      loadTable();
    };
    const handleAction = (gameId, player, action, amount) => {
      if (!isSameGame(gameId)) return;
      setNotification(`${player} ${action} (${amount})`);
      loadTable();
    };
    const handleWinner = (gameId, hid, winner, amount) => {
      if (!isSameGame(gameId)) return;
      setNotification(`Player ${winner} won ${amount} in hand ${hid}`);
      loadTable();
    };
    const handleFlop = (gameId, hid) => {
      if (!isSameGame(gameId)) return;
      setNotification(`Flop dealt in hand ${hid}`);
      loadTable();
    };
    const handleTurn = (gameId, hid) => {
      if (!isSameGame(gameId)) return;
      setNotification(`Turn dealt in hand ${hid}`);
      loadTable();
    };
    const handleRiver = (gameId, hid) => {
      if (!isSameGame(gameId)) return;
      setNotification(`River dealt in hand ${hid}`);
      loadTable();
    };
    const handleHandClosed = (gameId, hid, _privateKeys, valid) => {
      if (!isSameGame(gameId)) return;
      setNotification(`Hand ${hid} closed (${valid ? 'valid' : 'invalid'})`);
      loadTable();
    };

    pokerGame.on('PlayerJoined', handlePlayerJoined);
    pokerGame.on('NewHand', handleNewHand);
    pokerGame.on('NewRound', handleNewRound);
    pokerGame.on('Action', handleAction);
    pokerGame.on('Winner', handleWinner);

    pokerDealer.on('Flop', handleFlop);
    pokerDealer.on('Turn', handleTurn);
    pokerDealer.on('River', handleRiver);
    pokerDealer.on('HandClosed', handleHandClosed);

    const interval = setInterval(() => {
      loadTable();
    }, 7000);

    return () => {
      clearInterval(interval);
      pokerGame.off('PlayerJoined', handlePlayerJoined);
      pokerGame.off('NewHand', handleNewHand);
      pokerGame.off('NewRound', handleNewRound);
      pokerGame.off('Action', handleAction);
      pokerGame.off('Winner', handleWinner);
      pokerDealer.off('Flop', handleFlop);
      pokerDealer.off('Turn', handleTurn);
      pokerDealer.off('River', handleRiver);
      pokerDealer.off('HandClosed', handleHandClosed);
    };
  }, [gid, loadTable]);

  return (
  <div id="table">
    <div className="rotate-notice">
      <div>
        <div className="logo">Decent<span className="grey">Poker</span></div>
        <p>Please rotate your device to landscape mode</p>
      </div>
    </div>
    <div className="header pointer" onClick={() => window.location = '/'}>
      <div className="logo">Decent<span className="grey">Poker</span></div>
    </div>
    <div id="table-title">Decent<span className="table-title-alt">Poker</span></div>
    <div id="group-cards">
      {communityCards.map((cardId, index) => {
        const filename = cardIdToFilename(cardId);
        if (!filename) return null;
        return (
          <img
            key={`${filename}-${index}`}
            src={`img/cards/${filename}`}
            className="group-card"
            alt="Community Card"
          />
        );
      })}
    </div>
    <div id="players"></div>
    <div id="pot-chips"></div>
    <div id="pot">
        <div id="pot-text-container">
          <span id="pot-text" className="green">&ETH;</span>
          <span className="pot-value" id="pot-value">{ethers.formatUnits(tableState.potTotal ?? 0n, 6)}</span>
        </div>
        <div id="blinds">{ethers.formatUnits((tableState.bigBlind ?? 0n) / 2n, 6)}/{ethers.formatUnits(tableState.bigBlind ?? 0n, 6)}</div>
        <div id="blind-clock">{gameStates[tableState.state] ?? 'Unknown'}</div>
    </div>
    {sngMeta && (
      <div id="sng-meta">
        <div>SNG started: {sngMeta.startTimestamp > 0n ? new Date(Number(sngMeta.startTimestamp) * 1000).toLocaleString() : 'Not started'}</div>
        <div>Blind duration: {sngMeta.blindDuration > 0n ? `${Math.max(1, Math.round(Number(sngMeta.blindDuration) / 60))} mins` : '-'}</div>
        <div>Next blind: {ethers.formatUnits(sngMeta.nextBlind ?? 0n, 6)}</div>
        {sngMeta.lastBlindUpdate > 0n && (Math.floor(Date.now() / 1000) > Number(sngMeta.lastBlindUpdate + sngMeta.blindDuration)) && (
          <button type="button" className="standard-button" onClick={handleUpdateBlinds} disabled={isTxPending}>Update Blinds</button>
        )}
      </div>
    )}
    <div id="winner" className="hidden"></div>
    <div id="table-notification">{notification}</div>
    <div id="action-buttons">
      {tableState.state === 0 && activePlayers >= 2 && (
        <button type="button" className="standard-button" onClick={handleDealHand} disabled={isTxPending}>Deal Hand</button>
      )}
      {isMyTurn && (
        <div>
          <div id="action-tier3">
            <button type="button" className="action-button standard-button" onClick={() => handlePlayerAction(0, 0n)} disabled={!canFold || isTxPending}>FOLD</button>
            <button type="button" className="action-button standard-button" onClick={() => handlePlayerAction(1, 0n)} disabled={!canCheck || isTxPending}>CHECK</button>
            <button type="button" className="action-button standard-button" onClick={() => handlePlayerAction(2, 0n)} disabled={!canCall || isTxPending}>CALL</button>
          </div>
          <div id="action-tier2">
            <div className="slider-container">
              <div id="slider-value-display">Raise To (max {ethers.formatUnits(maxRaiseTo ?? 0n, 6)} PKR)</div>
              <input
                type="number"
                min={ethers.formatUnits((tableState.currentBet ?? 0n) + 1n, 6)}
                max={ethers.formatUnits(maxRaiseTo ?? 0n, 6)}
                step="0.01"
                className="slider"
                value={raiseTo}
                onChange={(event) => setRaiseTo(event.target.value)}
              />
            </div>
            <button type="button" className="action-button standard-button" onClick={handleRaise} disabled={!canRaise || isTxPending}>RAISE</button>
          </div>
        </div>
      )}
    </div>
    <div id="checkboxes">
      <div className="checkbox-container">
        <button type="button" className="standard-button" onClick={handleLeaveGame} disabled={isTxPending}>Leave Table</button>
      </div>
      <div className="checkbox-container">
        <button type="button" className="standard-button" onClick={handleAutoFold} disabled={isTxPending}>Auto Fold</button>
      </div>
    </div>

    <div id="countdown-timer-container" className="hidden">
        <svg id="countdown-timer" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
            <g>
                <circle id="timer-animation" r="16" cy="20" cx="20" />
                <circle id="timer-circle" r="12" cx="20" cy="20" />
            </g>
        </svg>
        <div id="countdown-timer-text"></div>
    </div>

    {seatIds.map((seatNumber, idx) => {
      const player = players[idx];
      const hasPlayer = player && player.addr !== ethers.ZeroAddress && !player.outOfRange;
      const isFolded = player?.hasFolded;
      const isActionOn = idx === tableState.actionOnSeat && hasPlayer;
      const isDealer = idx === tableState.dealerSeat && hasPlayer;
      const isLocalSeat = localSeatIndex === idx;
      const seatClassNames = [
        'player-container',
        !hasPlayer || player?.outOfRange ? 'disabled' : '',
        isFolded ? 'seat-folded' : '',
        isActionOn ? 'seat-action' : '',
      ].filter(Boolean).join(' ');
      const stackText = hasPlayer ? ethers.formatUnits(player.chips ?? 0n, 6) : '';
      const betText = hasPlayer && (player.currentBet ?? 0n) > 0n ? ethers.formatUnits(player.currentBet ?? 0n, 6) : '';
      const statusText = hasPlayer ? (isFolded ? 'Folded' : isActionOn ? 'Action' : '') : '';

      return (
        <div key={seatNumber} id={`seat${seatNumber}-player`} className={seatClassNames}>
          <div id={`seat${seatNumber}-cards`} className="cards-container">
            {isLocalSeat && holeCards.map((cardId, index) => {
              const filename = cardIdToFilename(cardId);
              if (!filename) return null;
              return (
                <img
                  key={`${seatNumber}-${filename}-${index}`}
                  src={`img/cards/${filename}`}
                  className="card hole-card"
                  alt="Hole Card"
                />
              );
            })}
          </div>
          <img src="img/avatars/player.svg" className="player-frame" id={`seat${seatNumber}-frame`} alt="" />
          <img src="" id={`seat${seatNumber}-pic`} className="table-pic hidden" alt="" />
          <img src="img/avatars/avatar0.svg" id={`seat${seatNumber}-avatar`} className="player-avatar" alt="" />
          <div id={`seat${seatNumber}-stack`} className="player-stack">{stackText}</div>
          <div id={`seat${seatNumber}-name`} className="player-name">{shortAddress(player?.addr)}</div>
          <div id={`seat${seatNumber}-timer-container`} className="player-timer-container"></div>
          <div id={`seat${seatNumber}-status`} className={`player-status ${statusText ? '' : 'hidden'}`}>{statusText}</div>
          <div id={`seat${seatNumber}-bet`} className="bet-area">
            {isDealer && <img src="img/chips/dealer.svg" className="dealer-chip" alt="Dealer" />}
            {betText && <span className="bet-amount-text">{betText}</span>}
          </div>
        </div>
      );
    })}

  </div>
  );
}

export default Table;
