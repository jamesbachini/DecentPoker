import { ethers } from 'ethers';

const Utils = {
  loadWallet: async () => {
    let walletJSON = localStorage.getItem('wallet');
    if (walletJSON === null) {
      await Utils.createWallet(); // Assuming createWallet is part of Utils or elsewhere
      walletJSON = localStorage.getItem('wallet');
    }
    const wallet = JSON.parse(walletJSON);
    let virtualWallet;
    let provider;

    if (wallet.type === 'browser') {
      provider = new ethers.BrowserProvider(window.ethereum);
      virtualWallet = await provider.getSigner();
    } else {
      provider = ethers.getDefaultProvider(); // Or your desired provider setup
      const loadedWallet = new ethers.Wallet(wallet.privateKey);
      virtualWallet = loadedWallet.connect(provider);
    }
    return virtualWallet;
  },

  copyToClipBoard: async (containerid) => {
    let range;
    if (document.selection) {
      range = document.body.createTextRange();
      range.moveToElementText(document.getElementById(containerid));
      range.select().createTextRange();
      document.execCommand("Copy");
    } else if (window.getSelection) {
      range = document.createRange();
      range.selectNode(document.getElementById(containerid));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand("Copy");
    }
  },

  createKeyPair: () => {
    const randomBytes = ethers.randomBytes(32);
    const privateKey = ethers.hexlify(randomBytes);
    const publicKey = ethers.keccak256(privateKey);
    return { privateKey, publicKey };
  },
};

export default Utils;
