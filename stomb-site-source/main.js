import * as bitcoin from 'bitcoinjs-lib';
import { Runestone, RuneId, none, some } from 'runelib';

const RUNE_NAME = 'STOMB'; // confirmed etched on Bitcoin mainnet — id 968575:856
const RUNE_ID = '968575:856';
const UNISAT_MINT_URL = 'https://uniscan.cc/runes/detail/STOMB'; // fallback if the in-page mint fails
const POSTAGE = 546;   // dust-limit output that will carry your minted STOMB
const FEE_RATE = 5;    // sats/vB — conservative flat estimate

const connectBtn = document.getElementById('connectBtn');
const mintBtn = document.getElementById('mintBtn');
const notice = document.getElementById('notice');

function showNotice(msg) {
  notice.textContent = msg;
  notice.classList.add('show');
}

let userPaymentAddress = null;
let userOrdinalsAddress = null;

// Wallet connection uses the UniSat extension's own injected API directly.
async function connectWallet() {
  if (typeof window.unisat === 'undefined') {
    showNotice('UniSat wallet not detected. Install the UniSat extension to connect a Bitcoin wallet.');
    return;
  }
  try {
    const accounts = await window.unisat.requestAccounts();
    if (accounts && accounts.length) {
      userPaymentAddress = accounts[0];
      userOrdinalsAddress = accounts[0];
      connectBtn.textContent = userPaymentAddress.slice(0, 6) + '…' + userPaymentAddress.slice(-4);
      mintBtn.textContent = 'Mint STOMB';
      mintBtn.disabled = false;
      showNotice('Wallet connected.');
    }
  } catch (err) {
    showNotice('Connection refused or unavailable.');
  }
}

connectBtn.addEventListener('click', connectWallet);

function estimateFeeSats(inputCount) {
  return (150 * inputCount + 150) * FEE_RATE; // generous overestimate, errs toward overpaying rather than a stuck tx
}

mintBtn.addEventListener('click', async () => {
  if (!userPaymentAddress) { showNotice('Connect your wallet first.'); return; }
  mintBtn.disabled = true;
  const prevLabel = mintBtn.textContent;
  try {
    mintBtn.textContent = 'Fetching your UTXOs…';
    const utxoRes = await fetch(`https://mempool.space/api/address/${userPaymentAddress}/utxo`);
    if (!utxoRes.ok) throw new Error('could not fetch your UTXOs from mempool.space');
    const utxos = (await utxoRes.json()).sort((a, b) => b.value - a.value);
    if (!utxos.length) throw new Error('no spendable BTC found in your connected address');

    let inputs = [];
    let total = 0;
    for (const u of utxos) {
      inputs.push(u);
      total += u.value;
      if (total >= POSTAGE + estimateFeeSats(inputs.length)) break;
    }
    const fee = estimateFeeSats(inputs.length);
    const change = total - POSTAGE - fee;
    if (change < 0) throw new Error('not enough BTC in your wallet to cover postage and fees');

    const network = bitcoin.networks.bitcoin;
    const scriptPubKey = bitcoin.address.toOutputScript(userPaymentAddress, network);
    const psbt = new bitcoin.Psbt({ network });
    for (const u of inputs) {
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        witnessUtxo: { script: scriptPubKey, value: BigInt(u.value) }, // bitcoinjs-lib v7 requires BigInt satoshi values
      });
    }

    const [block, tx] = RUNE_ID.split(':').map(Number);
    const mintstone = new Runestone([], none(), some(new RuneId(block, tx)), some(1));
    psbt.addOutput({ script: mintstone.encipher(), value: 0n });                // output 0: OP_RETURN Runestone
    psbt.addOutput({ address: userOrdinalsAddress, value: BigInt(POSTAGE) });   // output 1: carries your minted STOMB (pointer=1)
    if (change > 546) {
      psbt.addOutput({ address: userPaymentAddress, value: BigInt(change) });  // output 2: change back to you
    }

    const psbtHex = psbt.toHex();

    const proceed = window.confirm(
      `About to mint 1,000 STOMB.\n\nInputs used: ${inputs.length}\nPostage: ${POSTAGE} sats (stays with you)\nEstimated network fee: ${fee} sats\nChange back to you: ${Math.max(change, 0)} sats\n\nYour wallet will show the final amounts next — check them before signing. Continue?`
    );
    if (!proceed) { showNotice('Cancelled.'); return; }

    mintBtn.textContent = 'Confirm in your wallet…';
    const signedHex = await window.unisat.signPsbt(psbtHex);
    mintBtn.textContent = 'Broadcasting…';
    const txid = await window.unisat.pushPsbt(signedHex);
    showNotice('Mint transaction sent — txid: ' + txid + '. Your STOMB will show once it confirms.');
  } catch (err) {
    showNotice('Mint failed: ' + (err?.message || 'unknown error') + '. You can also mint directly on UniSat: ' + UNISAT_MINT_URL);
  } finally {
    mintBtn.disabled = false;
    mintBtn.textContent = prevLabel;
  }
});

// --- Third-party indexer (Hiro Runes API) ---
const TICKER = 'STOMB';
const HIRO_BASE = 'https://api.hiro.so/runes/v1/etchings';
const MAX_SUPPLY = 21000000;

function fmt(n) { return Number(n).toLocaleString('en-US'); }
function shortAddr(a) { return a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a; }

async function loadTokenStats() {
  try {
    const res = await fetch(`${HIRO_BASE}/${TICKER}`);
    if (!res.ok) { return; } // not etched, endpoint moved, or CORS-blocked — page stays on defaults
    const data = await res.json();
    const minted = Number(data.supply.minted);
    const pct = Math.min(100, (minted / MAX_SUPPLY) * 100);

    document.getElementById('mintedStat').textContent = fmt(minted);
    document.getElementById('lineFill').style.width = pct.toFixed(2) + '%';
    document.getElementById('gaugeSub2').textContent = `${fmt(minted)} / ${fmt(MAX_SUPPLY)} STOMB · ${pct.toFixed(1)}%`;
  } catch (err) {
    // ignore — indexer unreachable, page stays on default values
  }
}

async function loadHolders() {
  try {
    const res = await fetch(`${HIRO_BASE}/${TICKER}/holders?limit=20`);
    if (!res.ok) { return; }
    const data = await res.json();
    if (!data.results || !data.results.length) return;

    const body = document.getElementById('holdBody');
    const table = document.getElementById('holdTable');
    const empty = document.getElementById('holdEmpty');
    body.innerHTML = '';
    data.results.forEach((h, i) => {
      const balance = Number(h.balance);
      const pct = ((balance / MAX_SUPPLY) * 100).toFixed(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${i + 1}</td><td>${shortAddr(h.address)}</td><td>${fmt(balance)}</td><td>${pct}%</td>`;
      body.appendChild(tr);
    });
    table.style.display = 'table';
    empty.style.display = 'none';
  } catch (err) {
    // ignore
  }
}

loadTokenStats();
loadHolders();
