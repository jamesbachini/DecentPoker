import { ethers } from 'ethers';
import {
  BASE_SEPOLIA_RPC_URL,
  BASE_SEPOLIA_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID_HEX,
} from './config';

const RPC_URL_STORAGE_KEY = 'baseSepoliaRpcUrl';
let cachedProvider;
let cachedRpcUrl;

const normalizeRpcUrl = (rpcUrl) => {
  if (!rpcUrl) return '';
  return rpcUrl.trim();
};

const Utils = {
  getRpcUrl: () => {
    const stored = normalizeRpcUrl(localStorage.getItem(RPC_URL_STORAGE_KEY));
    return stored || BASE_SEPOLIA_RPC_URL;
  },

  getRpcUrls: () => {
    const stored = normalizeRpcUrl(localStorage.getItem(RPC_URL_STORAGE_KEY));
    const urls = [];
    if (stored) urls.push(stored);
    if (BASE_SEPOLIA_RPC_URL && BASE_SEPOLIA_RPC_URL !== stored) {
      urls.push(BASE_SEPOLIA_RPC_URL);
    }
    return urls;
  },

  setRpcUrl: (rpcUrl) => {
    const normalized = normalizeRpcUrl(rpcUrl);
    if (normalized) {
      localStorage.setItem(RPC_URL_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(RPC_URL_STORAGE_KEY);
    }
    cachedProvider = null;
    cachedRpcUrl = null;
  },

  getProvider: () => {
    const rpcUrl = Utils.getRpcUrl();
    if (!cachedProvider || cachedRpcUrl !== rpcUrl) {
      cachedProvider = new ethers.JsonRpcProvider(rpcUrl);
      cachedRpcUrl = rpcUrl;
    }
    return cachedProvider;
  },

  ensureMetaMask: () => {
    if (!window.ethereum) {
      throw new Error('MetaMask not detected. Install it to use a browser wallet.');
    }
  },

  switchToBaseSepolia: async () => {
    Utils.ensureMetaMask();
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (error) {
      if (error?.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              rpcUrls: Utils.getRpcUrls(),
              blockExplorerUrls: ['https://sepolia.basescan.org'],
            },
          ],
        });
      } else {
        throw error;
      }
    }
  },

  testRpcUrl: async (rpcUrl, timeoutMs = 8000) => {
    const normalized = normalizeRpcUrl(rpcUrl);
    if (!normalized) {
      throw new Error('RPC URL is empty.');
    }
    const provider = new ethers.JsonRpcProvider(normalized);
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('RPC timeout')), timeoutMs);
    });
    await Promise.race([provider.getBlockNumber(), timeout]);
  },

  getRpcErrorHint: (error) => {
    const message = error?.reason || error?.message || '';
    let serialized = '';
    try {
      serialized = JSON.stringify(error);
    } catch (err) {
      serialized = '';
    }
    const combined = `${message} ${serialized}`;
    if (combined.includes('Failed to fetch') || combined.includes('NETWORK_ERROR') || combined.includes('RPC timeout')) {
      return 'RPC unreachable. Check your Base Sepolia RPC in MetaMask or set a custom RPC in Wallet Management.';
    }
    return '';
  },

  createWallet: async () => {
    const tmpWallet = ethers.Wallet.createRandom();
    const walletAddress = await tmpWallet.getAddress();
    const newWallet = {
      name: 'Virtual Wallet 1',
      privateKey: tmpWallet.privateKey,
      address: walletAddress,
      type: 'virtual',
    };
    localStorage.setItem('wallet', JSON.stringify(newWallet));
    return newWallet;
  },

  loadWallet: async () => {
    let walletJSON = localStorage.getItem('wallet');
    if (walletJSON === null) {
      await Utils.createWallet();
      walletJSON = localStorage.getItem('wallet');
    }
    const wallet = JSON.parse(walletJSON);

    if (wallet.type === 'browser') {
      await Utils.switchToBaseSepolia();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return { provider, signer, wallet };
    }

    const provider = Utils.getProvider();
    const signer = new ethers.Wallet(wallet.privateKey, provider);
    return { provider, signer, wallet };
  },

  copyToClipBoard: async (containerid) => {
    let range;
    if (document.selection) {
      range = document.body.createTextRange();
      range.moveToElementText(document.getElementById(containerid));
      range.select().createTextRange();
      document.execCommand('Copy');
    } else if (window.getSelection) {
      range = document.createRange();
      range.selectNode(document.getElementById(containerid));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand('Copy');
    }
  },

  createKeyPair: () => {
    const randomBytes = ethers.randomBytes(32);
    const privateKey = ethers.hexlify(randomBytes);
    const publicKey = ethers.keccak256(privateKey);
    return { privateKey, publicKey };
  },

  getHandKeys: (gid) => {
    if (gid === null || gid === undefined) return null;
    const gameId = gid.toString();
    const currentPrivateKey = localStorage.getItem(`currentPrivateKey_${gameId}`);
    const currentPublicKey = localStorage.getItem(`currentPublicKey_${gameId}`);
    const nextPrivateKey = localStorage.getItem(`nextPrivateKey_${gameId}`);
    const nextPublicKey = localStorage.getItem(`nextPublicKey_${gameId}`);
    if (!currentPrivateKey || !currentPublicKey) return null;
    return { currentPrivateKey, currentPublicKey, nextPrivateKey, nextPublicKey };
  },

  ensureHandKeys: (gid) => {
    if (gid === null || gid === undefined) return null;
    const gameId = gid.toString();
    let currentPrivateKey = localStorage.getItem(`currentPrivateKey_${gameId}`);
    let currentPublicKey = localStorage.getItem(`currentPublicKey_${gameId}`);
    let nextPrivateKey = localStorage.getItem(`nextPrivateKey_${gameId}`);
    let nextPublicKey = localStorage.getItem(`nextPublicKey_${gameId}`);

    if (!currentPrivateKey || !currentPublicKey) {
      const current = Utils.createKeyPair();
      currentPrivateKey = current.privateKey;
      currentPublicKey = current.publicKey;
      localStorage.setItem(`currentPrivateKey_${gameId}`, currentPrivateKey);
      localStorage.setItem(`currentPublicKey_${gameId}`, currentPublicKey);
    }

    if (!nextPrivateKey || !nextPublicKey) {
      const next = Utils.createKeyPair();
      nextPrivateKey = next.privateKey;
      nextPublicKey = next.publicKey;
      localStorage.setItem(`nextPrivateKey_${gameId}`, nextPrivateKey);
      localStorage.setItem(`nextPublicKey_${gameId}`, nextPublicKey);
    }

    return { currentPrivateKey, currentPublicKey, nextPrivateKey, nextPublicKey };
  },

  rotateHandKeys: (gid) => {
    if (gid === null || gid === undefined) return null;
    const gameId = gid.toString();
    const keys = Utils.ensureHandKeys(gameId);
    if (!keys) return null;
    localStorage.setItem(`currentPrivateKey_${gameId}`, keys.nextPrivateKey);
    localStorage.setItem(`currentPublicKey_${gameId}`, keys.nextPublicKey);
    const newNext = Utils.createKeyPair();
    localStorage.setItem(`nextPrivateKey_${gameId}`, newNext.privateKey);
    localStorage.setItem(`nextPublicKey_${gameId}`, newNext.publicKey);
    return {
      currentPrivateKey: keys.nextPrivateKey,
      currentPublicKey: keys.nextPublicKey,
      nextPrivateKey: newNext.privateKey,
      nextPublicKey: newNext.publicKey,
    };
  },

  isBaseSepolia: (chainId) => {
    return Number(chainId) === BASE_SEPOLIA_CHAIN_ID;
  },
};

export default Utils;
