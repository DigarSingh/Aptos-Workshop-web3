import './style.css'
import { create } from 'ipfs-http-client'
import BigNumber from 'bignumber.js'

// Aptos devnet account & module identifiers
const DEVNET_ACCOUNT_ADDRESS = "0xe8bbda11f2562947e4518f58dbacdf4df1dd2c192157de8c190495b30660584b";
const MODULE_ID = `${DEVNET_ACCOUNT_ADDRESS}::book_library::book_library`;
const REST_URL = 'https://fullnode.devnet.aptoslabs.com/v1';
const COST_DECIMALS = 6; // Adjustable precision for displayed costs

const ipfsClient = create({
  url: 'https://ipfs.infura.io:5001/api/v0'
})

let aptosAccount = DEVNET_ACCOUNT_ADDRESS;
let services = [];


window.addEventListener('load', async () => {
  bookNotification("⌛ Loading...");
  await connectPetraWallet();
  await getBooks();
  bookNotificationOff();
});

window.addEventListener('refresh-books', async () => {
  bookNotification('⌛ Refreshing books...');
  await getBooks();
  bookNotificationOff();
});


const connectPetraWallet = async function () {
  if (window.aptos) {
    try {
      // Request connection to Petra wallet
      const response = await window.aptos.connect();
      aptosAccount = response.address;
      bookNotification(`✅ Connected to Petra wallet: ${aptosAccount}`);
    } catch (error) {
      bookNotification(`⚠️ Petra wallet connection error: ${error}`);
    }
  } else {
    bookNotification("⚠️ Please install the Petra Aptos Wallet extension.");
  }
}

// View fetch using get_books returning parallel vectors
const getBooks = async function () {
  try {
    const payload = {
      function: `${MODULE_ID}::get_books`,
      type_arguments: [],
      arguments: [DEVNET_ACCOUNT_ADDRESS]
    };
    const res = await fetch(`${REST_URL}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`books view HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length !== 9) throw new Error('Unexpected view shape');
    const [ids, titles, isbns, dates, summaries, coverUris, bookUris, costs, rentedFlags] = data;
    services = ids.map((id, i) => ({
      index: id,
      owner: DEVNET_ACCOUNT_ADDRESS,
      title: titles[i],
      isbn: isbns[i],
      date: dates[i],
      summary: summaries[i],
      image: coverUris[i],
      book: bookUris[i],
      cost: new BigNumber(costs[i] || 0),
      rented: rentedFlags[i]
    }));
    renderBooks();
  } catch (e) {
    console.error(e);
    bookNotification(`⚠️ Load books failed: ${e.message}`);
  }
}

async function signAndSubmit(functionName, args) {
  if (!window.aptos) throw new Error('Petra wallet not detected');
  const txn = {
    type: 'entry_function_payload',
    function: `${MODULE_ID}::${functionName}`,
    type_arguments: [],
    arguments: args
  };
  const pending = await window.aptos.signAndSubmitTransaction(txn);
  await waitForTxn(pending.hash);
  return pending.hash;
}

async function waitForTxn(hash) {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${REST_URL}/transactions/by_hash/${hash}`);
    if (r.ok) {
      const j = await r.json();
      if (j.type !== 'pending_transaction') return j;
    }
    await new Promise(res => setTimeout(res, 750));
  }
  throw new Error('Timeout waiting for transaction');
}


// upload file to IPFS
const uploadHelper = async (_file) => {
  try {
    const file = await ipfsClient.add(_file);
    const path = `https://ipfs.infura.io/ipfs/${file.path}`;
  
    return path;
  } catch (error) {
    console.log("Error uploading file: ", error);
    throw error;
  }
};

document
  .querySelector("#submit-book")
  .addEventListener("click", async (e) => {
    const selectedImage = document.getElementById("select-image").files[0];
    const selectedBook = document.getElementById("select-book").files[0];
    const ipfs_bookImage = await uploadHelper(selectedImage);
    const ipfs_book_doc = await uploadHelper(selectedBook);
    const rawCost = document.getElementById("input-cost").value || '0';
    const cost = new BigNumber(rawCost).shiftedBy(COST_DECIMALS).integerValue(BigNumber.ROUND_FLOOR).toString(10);
    const title = document.getElementById("input-title").value;
    const isbn = document.getElementById("input-isbn").value;
    const date = document.getElementById("input-date").value;
    const summary = document.getElementById("input-summary").value;
    bookNotification(`⌛ Adding "${title}"...`);
    try {
      await signAndSubmit('add_book', [title, isbn, date, summary, ipfs_bookImage, ipfs_book_doc, cost]);
      bookNotification(`🎉 Added "${title}".`);
      await getBooks();
    } catch (err) {
      bookNotification(`⚠️ Add failed: ${err.message}`);
    }
  })


  // rent a book
  document
  .querySelector("#rentBook")
  .addEventListener("click", async (e) => {
  

  const rentIdInput = document.getElementById('rent-id');
  if (!rentIdInput) {
    bookNotification('⚠️ Missing rent id input (#rent-id)');
    return;
  }
  const rentId = rentIdInput.value;
  if (rentId === '') {
    bookNotification('⚠️ Enter a book id to rent');
    return;
  }
  bookNotification(`⌛ Renting book id ${rentId}...`);
  try {
    await signAndSubmit('rent_book', [DEVNET_ACCOUNT_ADDRESS, rentId]);
    bookNotification(`🎉 Rented book id ${rentId}.`);
    await getBooks();
  } catch (err) {
    bookNotification(`⚠️ Rent failed: ${err.message}`);
  }
  })


function renderBooks() {
  document.getElementById("AvailableBooks").innerHTML = ""
  services.forEach((_book) => {
    const newDiv = document.createElement("div")
    newDiv.className = "col-md-4"
    newDiv.innerHTML = bookTemplate(_book)
    document.getElementById("AvailableBooks").appendChild(newDiv)
  })
}

function bookTemplate(_book) {
  const costDisplay = _book.cost ? _book.cost.shiftedBy(-COST_DECIMALS).toString(10) : '0';
  const rentedBadge = _book.rented ? '<span class="badge bg-warning ms-2">RENTED</span>' : '';
  return `
    <div class="card mb-4">
      <img class="card-img-top" src="${_book.image}" alt="...">
      <div class="card-body text-dark text-left p-4 position-relative">
        <div class="translate-middle-y position-absolute top-0">
          ${identiconTemplate(_book.owner)}
        </div>
        <h2 class="card-title fs-4 fw-bold mt-2">${_book.title} ${rentedBadge}</h2>
        <p class="card-text mb-1">ISBN: ${_book.isbn}</p>
        <p class="card-text mb-1">Date: ${_book.date}</p>
        <p class="card-text mb-2" style="min-height: 60px">${_book.summary}</p>
        <p class="card-text mb-2">Cost: ${costDisplay}</p>
        <a href="${_book.book}" target="_blank" class="btn btn-sm btn-outline-primary">Open Book</a>
      </div>
    </div>
  `
}


function identiconTemplate(_address) {
  const icon = blockies
    .create({
      seed: _address,
      size: 8,
      scale: 16,
    })
    .toDataURL()

  return `
  <div class="rounded-circle overflow-hidden d-inline-block border border-white border-2 shadow-sm m-0">
  <a href="https://explorer.aptoslabs.com/account/${_address}?network=devnet"
        target="_blank">
        <img src="${icon}" width="48" alt="${_address}">
    </a>
  </div>
  `
}

function bookNotification(_text) {
  document.querySelector(".alert-service").style.display = "block"
  document.querySelector("#bookNotification").textContent = _text
}

function bookNotificationOff() {
  document.querySelector(".alert-service").style.display = "none"
}