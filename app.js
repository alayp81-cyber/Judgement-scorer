const trumpCycle = [
  { key: "spades", label: "Spades", glyph: "♠", local: "Kari" },
  { key: "diamonds", label: "Diamonds", glyph: "♦", local: "Chukat" },
  { key: "clubs", label: "Clubs", glyph: "♣", local: "Phulli" },
  { key: "hearts", label: "Hearts", glyph: "♥", local: "Lal" },
];

const spokenNumberMap = {
  zero: 0,
  none: 0,
  one: 1,
  won: 1,
  two: 2,
  to: 2,
  too: 2,
  three: 3,
  four: 4,
  for: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
};

const state = {
  players: [],
  rounds: [],
  currentRoundIndex: 0,
  phase: "setup",
  selectedStartCards: 13,
  nextDealerPlayerId: null,
  managingPlayers: false,
  conversationalMode: false,
  voiceTarget: null,
  pendingTargetIndex: null,
  recognitionActive: false,
  voiceOutcome: "idle",
  voiceOptions: {},
  voicePermissionDenied: false,
  roundHistory: [],
  lastCompletedRound: null,
  finalReason: "",
};

const elements = {
  setupView: document.getElementById("setupView"),
  gameView: document.getElementById("gameView"),
  finalView: document.getElementById("finalView"),
  playerCount: document.getElementById("playerCount"),
  playerCountValue: document.getElementById("playerCountValue"),
  maxCards: document.getElementById("maxCards"),
  maxCardsValue: document.getElementById("maxCardsValue"),
  maxCardsHint: document.getElementById("maxCardsHint"),
  playerNamesContainer: document.getElementById("playerNamesContainer"),
  randomizeNamesBtn: document.getElementById("randomizeNamesBtn"),
  startGameBtn: document.getElementById("startGameBtn"),
  roundLabel: document.getElementById("roundLabel"),
  cardsLabel: document.getElementById("cardsLabel"),
  trumpLabel: document.getElementById("trumpLabel"),
  dealerLabel: document.getElementById("dealerLabel"),
  phaseTitle: document.getElementById("phaseTitle"),
  phaseSubtitle: document.getElementById("phaseSubtitle"),
  hookWarning: document.getElementById("hookWarning"),
  voiceStatus: document.getElementById("voiceStatus"),
  betweenRoundsPanel: document.getElementById("betweenRoundsPanel"),
  betweenRoundsMessage: document.getElementById("betweenRoundsMessage"),
  removePlayersPanel: document.getElementById("removePlayersPanel"),
  removePlayersList: document.getElementById("removePlayersList"),
  nextRoundBtn: document.getElementById("nextRoundBtn"),
  managePlayersBtn: document.getElementById("managePlayersBtn"),
  confirmRemovePlayersBtn: document.getElementById("confirmRemovePlayersBtn"),
  cancelRemovePlayersBtn: document.getElementById("cancelRemovePlayersBtn"),
  entryTable: document.getElementById("entryTable"),
  continueBtn: document.getElementById("continueBtn"),
  resetRoundBtn: document.getElementById("resetRoundBtn"),
  toggleConversationalBtn: document.getElementById("toggleConversationalBtn"),
  finishEarlyBtn: document.getElementById("finishEarlyBtn"),
  scoreboardBody: document.getElementById("scoreboardBody"),
  historyList: document.getElementById("historyList"),
  finalSummary: document.getElementById("finalSummary"),
  finalStandings: document.getElementById("finalStandings"),
  playAgainBtn: document.getElementById("playAgainBtn"),
};

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognitionCtor ? createRecognition() : null;
const synth = window.speechSynthesis || null;

initialize();

function initialize() {
  bindSetupEvents();
  syncMaxCardsControl(Number(elements.playerCount.value));
  renderPlayerInputs(Number(elements.playerCount.value));
  updateVoiceStatus(recognition ? "Voice status: idle" : "Speech recognition unavailable in this browser.");
  if (!recognition) {
    elements.toggleConversationalBtn.disabled = true;
    elements.toggleConversationalBtn.classList.add("cursor-not-allowed", "opacity-50");
  }
}

function bindSetupEvents() {
  elements.playerCount.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    elements.playerCountValue.textContent = String(value);
    syncMaxCardsControl(value);
    renderPlayerInputs(value);
  });

  elements.maxCards.addEventListener("input", (event) => {
    state.selectedStartCards = Number(event.target.value);
    elements.maxCardsValue.textContent = String(state.selectedStartCards);
  });

  elements.randomizeNamesBtn.addEventListener("click", randomizeNames);
  elements.startGameBtn.addEventListener("click", startGameFromSetup);
  elements.continueBtn.addEventListener("click", handleContinue);
  elements.resetRoundBtn.addEventListener("click", resetCurrentPhaseEntries);
  elements.nextRoundBtn.addEventListener("click", advanceToNextRound);
  elements.managePlayersBtn.addEventListener("click", openRemovePlayersPanel);
  elements.confirmRemovePlayersBtn.addEventListener("click", confirmPlayerRemoval);
  elements.cancelRemovePlayersBtn.addEventListener("click", closeRemovePlayersPanel);
  elements.toggleConversationalBtn.addEventListener("click", toggleConversationalMode);
  elements.finishEarlyBtn.addEventListener("click", () => finishGame("Ended early by table choice."));
  elements.playAgainBtn.addEventListener("click", resetToSetup);
}

function renderPlayerInputs(count) {
  const existing = Array.from(elements.playerNamesContainer.querySelectorAll("input")).map((input) => input.value.trim());
  elements.playerNamesContainer.innerHTML = "";

  for (let index = 0; index < count; index += 1) {
    const wrapper = document.createElement("label");
    wrapper.className = "card-block block";
    wrapper.innerHTML = `
      <span class="mb-2 block text-sm font-medium text-stone-200">Player ${index + 1}</span>
      <input
        type="text"
        class="w-full rounded-2xl border border-white/10 bg-stone-950/50 px-4 py-3 text-white outline-none transition focus:border-amber-300/60"
        maxlength="24"
        value="${escapeHtml(existing[index] || `Player ${index + 1}`)}"
      />
    `;
    elements.playerNamesContainer.appendChild(wrapper);
  }
}

function randomizeNames() {
  const ideas = ["Amyra", "Alay", "Shanay", "Apeksha"];
  const shuffled = [...ideas].sort(() => Math.random() - 0.5);
  Array.from(elements.playerNamesContainer.querySelectorAll("input")).forEach((input, index) => {
    input.value = shuffled[index] || `Player ${index + 1}`;
  });
}

function startGameFromSetup() {
  const names = Array.from(elements.playerNamesContainer.querySelectorAll("input")).map((input, index) => input.value.trim() || `Player ${index + 1}`);
  const playerCount = names.length;
  const selectedStartCards = Number(elements.maxCards.value);

  state.players = names.map((name, index) => ({
    id: index + 1,
    name,
    active: true,
    leftAfterRound: null,
    totalScore: 0,
    currentBid: null,
    currentTricks: null,
    history: [],
  }));

  state.selectedStartCards = selectedStartCards;
  state.rounds = buildRounds(playerCount, selectedStartCards);
  state.currentRoundIndex = 0;
  state.nextDealerPlayerId = state.players[0]?.id ?? null;
  state.phase = "bidding";
  state.managingPlayers = false;
  state.roundHistory = [];
  state.lastCompletedRound = null;
  state.finalReason = "";
  state.conversationalMode = false;
  state.voiceTarget = null;
  state.pendingTargetIndex = null;
  state.voiceOutcome = "idle";
  state.voiceOptions = {};
  state.voicePermissionDenied = false;

  elements.setupView.classList.add("hidden");
  elements.finalView.classList.add("hidden");
  elements.gameView.classList.remove("hidden");
  updateConversationalButton();
  renderGame();
}

function buildRounds(playerCount, preferredMaxCards) {
  const deckMaxCards = Math.floor(52 / playerCount);
  const maxCards = Math.max(1, Math.min(deckMaxCards, preferredMaxCards || deckMaxCards));
  const descent = Array.from({ length: maxCards - 1 }, (_, index) => maxCards - index);
  const ascent = Array.from({ length: maxCards }, (_, index) => index + 1);
  const sequence = [...descent, 1, ...ascent];
  return sequence.map((cards, index) => ({
    roundNumber: index + 1,
    cards,
    trump: trumpCycle[index % trumpCycle.length],
    dealerPlayerId: ((index % playerCount) + 1),
  }));
}

function renderGame() {
  if (state.phase === "between-rounds") {
    renderBetweenRounds();
    renderScoreboard();
    renderHistory();
    return;
  }

  const round = getCurrentRound();
  if (!round) {
    finishGame("Completed full round ladder.");
    return;
  }

  state.players.forEach((player) => {
    if (player.currentBid === undefined) player.currentBid = null;
    if (player.currentTricks === undefined) player.currentTricks = null;
  });

  elements.roundLabel.textContent = `${round.roundNumber} / ${state.rounds.length}`;
  elements.cardsLabel.textContent = String(round.cards);
  elements.trumpLabel.textContent = `${round.trump.label} ${round.trump.glyph}`;
  const dealer = getRoundDealer(round);
  elements.dealerLabel.textContent = dealer?.name || "-";
  elements.phaseTitle.textContent = state.phase === "bidding" ? "Enter bids" : "Score this round";
  elements.phaseSubtitle.textContent =
    state.phase === "bidding"
      ? `Enter bids first. Tricks stay on the sheet and unlock once bids are confirmed. Dealer is ${dealer?.name || "-"}.`
      : `Bids stay visible while you enter tricks. Actual tricks must sum to ${round.cards} before this round can score.`;
  elements.continueBtn.textContent = state.phase === "bidding" ? "Confirm Bids" : "Score Round";
  elements.betweenRoundsPanel.classList.add("hidden");
  elements.continueBtn.classList.remove("hidden");
  elements.resetRoundBtn.classList.remove("hidden");

  renderHookWarning();
  renderEntryTable();
  renderScoreboard();
  renderHistory();
}

function getCurrentRound() {
  return state.rounds[state.currentRoundIndex] || null;
}

function getActivePlayers() {
  return state.players.filter((player) => player.active);
}

function getRoundDealer(round = getCurrentRound()) {
  if (!round) return null;
  const activePlayers = getActivePlayers();
  if (!activePlayers.length) return null;
  const dealer = state.players.find((player) => player.id === round.dealerPlayerId && player.active);
  return dealer || activePlayers[0];
}

function getNextActivePlayerId(afterPlayerId) {
  const activePlayers = getActivePlayers();
  if (!activePlayers.length) return null;
  if (afterPlayerId == null) return activePlayers[0].id;
  const currentIndex = activePlayers.findIndex((player) => player.id === afterPlayerId);
  if (currentIndex === -1) return activePlayers[0].id;
  return activePlayers[(currentIndex + 1) % activePlayers.length].id;
}

function getBidOrder() {
  const round = getCurrentRound();
  const order = [];
  const activePlayers = getActivePlayers();
  const dealer = getRoundDealer(round);
  const dealerIndex = activePlayers.findIndex((player) => player.id === dealer?.id);
  const firstBidder = activePlayers.length ? (dealerIndex + 1) % activePlayers.length : 0;

  for (let offset = 0; offset < activePlayers.length; offset += 1) {
    order.push(activePlayers[(firstBidder + offset) % activePlayers.length].id);
  }
  return order;
}

function renderHookWarning() {
  const round = getCurrentRound();
  if (!round) {
    elements.hookWarning.classList.add("hidden");
    return;
  }
  const dealer = getRoundDealer(round);
  const forbiddenBid = getForbiddenBid();
  const validRange = forbiddenBid >= 0 && forbiddenBid <= round.cards;

  elements.hookWarning.textContent = state.phase === "bidding"
    ? validRange
      ? `${dealer?.name || "Dealer"} is dealer. Forbidden bid this round: ${forbiddenBid}.`
      : `${dealer?.name || "Dealer"} is dealer. No numeric bid is forbidden right now.`
    : `Scoring phase: bids are locked in. Tricks must total ${round.cards}.`;
  elements.hookWarning.classList.remove("hidden");
}

function getForbiddenBid() {
  if (state.phase !== "bidding") return null;
  const round = getCurrentRound();
  const order = getBidOrder();
  const dealer = getRoundDealer(round);
  const dealerPosition = order.indexOf(dealer?.id);
  const precedingPlayers = order.slice(0, dealerPosition);
  const enteredTotal = precedingPlayers.reduce((sum, playerId) => sum + (Number(findPlayerById(playerId)?.currentBid) || 0), 0);
  return round.cards - enteredTotal;
}

function renderEntryTable() {
  const round = getCurrentRound();
  const order = getBidOrder();
  const maxValue = round.cards;
  const forbiddenBid = getForbiddenBid();

  elements.entryTable.innerHTML = "";

  order.forEach((playerIndex, position) => {
    const player = findPlayerById(playerIndex);
    const dealer = getRoundDealer(round);
    const isDealer = dealer?.id === playerIndex;
    const isActiveVoice = state.voiceTarget === playerIndex;
    const row = document.createElement("div");
    row.className = `player-entry card-block ${isActiveVoice ? "active-voice" : ""}`;

    const wrapper = document.createElement("div");
    wrapper.className = "grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]";

    const identity = document.createElement("div");
    identity.className = "flex items-center gap-3";
    identity.innerHTML = `
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 font-display text-lg font-bold text-white">
        ${position + 1}
      </div>
      <div>
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold text-white">${escapeHtml(player.name)}</span>
          ${isDealer ? '<span class="dealer-badge">D</span>' : ""}
        </div>
        <p class="text-sm text-stone-400">${getEntryHint(isDealer, forbiddenBid, round.cards)}</p>
      </div>
    `;

    const bidWrap = document.createElement("div");
    bidWrap.className = "space-y-2";
    bidWrap.innerHTML = '<label class="block text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Bid</label>';
    const bidInput = createNumberInput(playerIndex, "currentBid", player.currentBid, maxValue, false);
    bidInput.disabled = state.phase === "results";
    if (bidInput.disabled) {
      bidInput.classList.add("opacity-80");
    }
    bidWrap.appendChild(bidInput);

    const tricksWrap = document.createElement("div");
    tricksWrap.className = "space-y-2";
    tricksWrap.innerHTML = '<label class="block text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Tricks Won</label>';
    const tricksInput = createNumberInput(playerIndex, "currentTricks", player.currentTricks, maxValue, state.phase === "bidding");
    if (tricksInput.disabled) {
      tricksInput.placeholder = "Unlocks after bids";
    }
    tricksWrap.appendChild(tricksInput);

    const voiceButton = document.createElement("button");
    voiceButton.type = "button";
    voiceButton.className =
      "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-stone-200 transition hover:border-amber-300/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
    voiceButton.textContent = recognition ? "Tap to Speak" : "Voice Unavailable";
    voiceButton.disabled = !recognition;
    voiceButton.addEventListener("click", () => beginVoiceCapture(playerIndex));

    wrapper.append(identity, bidWrap, tricksWrap, voiceButton);
    row.appendChild(wrapper);
    elements.entryTable.appendChild(row);
  });
}

function createNumberInput(playerIndex, field, value, maxValue, disabled) {
  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = String(maxValue);
  input.step = "1";
  input.value = value ?? "";
  input.disabled = disabled;
  input.className =
    "w-full rounded-2xl border border-white/10 bg-stone-950/50 px-4 py-3 text-lg font-semibold text-white outline-none transition focus:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50";
  input.dataset.playerIndex = String(playerIndex);
  input.dataset.field = field;
  input.addEventListener("input", handleNumericInput);
  return input;
}

function getEntryHint(isDealer, forbiddenBid, cards) {
  if (state.phase === "bidding") {
    if (isDealer && forbiddenBid !== null && forbiddenBid >= 0 && forbiddenBid <= cards) {
      return `Enter predicted tricks. Forbidden bid: ${forbiddenBid}.`;
    }
    return "Enter predicted tricks first. Tricks unlock after bid confirmation.";
  }
  return "Bids are locked. Enter the actual tricks won.";
}

function handleNumericInput(event) {
  const playerIndex = Number(event.target.dataset.playerIndex);
  const field = event.target.dataset.field;
  const round = getCurrentRound();
  const numericValue = event.target.value === "" ? null : Number(event.target.value);

  if (numericValue !== null && (numericValue < 0 || numericValue > round.cards)) {
    event.target.value = "";
    findPlayerById(playerIndex)[field] = null;
    return;
  }

  findPlayerById(playerIndex)[field] = numericValue;
  if (state.phase === "bidding") renderHookWarning();
}

function handleContinue() {
  if (state.phase === "bidding") {
    submitBids();
  } else {
    submitResults();
  }
}

function submitBids() {
  const round = getCurrentRound();
  const activePlayers = getActivePlayers();
  const incomplete = activePlayers.find((player) => player.currentBid === null || player.currentBid === "");
  if (incomplete) {
    window.alert("Enter a bid for every player before continuing.");
    return;
  }

  const dealer = getRoundDealer(round);
  const totalBid = activePlayers.reduce((sum, player) => sum + Number(player.currentBid), 0);
  if (totalBid === round.cards) {
    window.alert(`${dealer?.name || "Dealer"} cannot make the total bids equal ${round.cards}.`);
    return;
  }

  state.phase = "results";
  state.voiceTarget = null;
  state.pendingTargetIndex = null;
  renderGame();
  if (state.conversationalMode) {
    startConversationalSequence();
  }
}

function submitResults() {
  const round = getCurrentRound();
  const activePlayers = getActivePlayers();
  const incomplete = activePlayers.find((player) => player.currentTricks === null || player.currentTricks === "");
  if (incomplete) {
    window.alert("Enter tricks won for every player before scoring the round.");
    return;
  }

  const totalTricks = activePlayers.reduce((sum, player) => sum + Number(player.currentTricks), 0);
  if (totalTricks !== round.cards) {
    window.alert(`Actual tricks must total ${round.cards}. Current total is ${totalTricks}.`);
    return;
  }

  const summary = {
    roundNumber: round.roundNumber,
    cards: round.cards,
    trump: round.trump.label,
    players: [],
  };

  activePlayers.forEach((player) => {
    const bid = Number(player.currentBid);
    const tricks = Number(player.currentTricks);
    const roundScore = bid === tricks ? 10 + bid : 0;
    player.totalScore += roundScore;
    player.history.push({ roundNumber: round.roundNumber, bid, tricks, roundScore });
    summary.players.push({ name: player.name, bid, tricks, roundScore });
    player.currentBid = null;
    player.currentTricks = null;
  });

  state.players
    .filter((player) => !player.active)
    .forEach((player) => {
      player.currentBid = null;
      player.currentTricks = null;
    });

  state.roundHistory.unshift(summary);
  state.lastCompletedRound = round;
  state.phase = "between-rounds";
  state.voiceTarget = null;
  state.pendingTargetIndex = null;
  state.managingPlayers = false;
  stopVoiceCapture({ clearPending: true, updateStatus: false });
  renderGame();
}

function renderScoreboard() {
  const ranked = [...getActivePlayers()].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));
  elements.scoreboardBody.innerHTML = "";

  ranked.forEach((player, index) => {
    const original = state.players.find((entry) => entry.id === player.id);
    const tr = document.createElement("tr");
    tr.className = index === 0 ? "bg-amber-300/5" : "";
    tr.innerHTML = `
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-white">${escapeHtml(player.name)}</span>
          ${index === 0 ? '<span class="rounded-full bg-amber-300/15 px-2 py-1 text-xs font-semibold text-amber-100">Lead</span>' : ""}
        </div>
      </td>
      <td class="px-4 py-3 font-semibold text-white">${player.totalScore}</td>
      <td class="px-4 py-3 text-stone-300">${original.currentBid ?? "-"}</td>
      <td class="px-4 py-3 text-stone-300">${original.currentTricks ?? "-"}</td>
    `;
    elements.scoreboardBody.appendChild(tr);
  });
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (!state.roundHistory.length) {
    const empty = document.createElement("div");
    empty.className = "card-block text-sm text-stone-400";
    empty.textContent = "Round summaries will appear here once scoring begins.";
    elements.historyList.appendChild(empty);
    return;
  }

  state.roundHistory.slice(0, 6).forEach((entry) => {
    const card = document.createElement("div");
    card.className = "card-block";
    const highlights = entry.players
      .map((player) => `${player.name}: ${player.bid}/${player.tricks} (${player.roundScore})`)
      .join(" • ");
    card.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-white">Round ${entry.roundNumber}</div>
          <div class="mt-1 text-xs uppercase tracking-[0.2em] text-stone-400">${entry.cards} cards • ${entry.trump}</div>
        </div>
      </div>
      <p class="mt-3 text-sm text-stone-300">${escapeHtml(highlights)}</p>
    `;
    elements.historyList.appendChild(card);
  });
}

function resetCurrentPhaseEntries() {
  if (state.phase === "bidding") {
    getActivePlayers().forEach((player) => {
      player.currentBid = null;
      player.currentTricks = null;
    });
  } else {
    getActivePlayers().forEach((player) => {
      player.currentTricks = null;
    });
  }
  stopVoiceCapture({ clearPending: true });
  renderGame();
}

function toggleConversationalMode() {
  state.conversationalMode = !state.conversationalMode;
  updateConversationalButton();

  if (state.conversationalMode) {
    startConversationalSequence();
  } else {
    stopVoiceCapture({ clearPending: true });
    state.voiceTarget = null;
    renderEntryTable();
  }
}

function updateConversationalButton() {
  elements.toggleConversationalBtn.textContent = `Conversational Mode: ${state.conversationalMode ? "On" : "Off"}`;
}

function startConversationalSequence() {
  if (!recognition) {
    updateVoiceStatus("Speech recognition unavailable in this browser.");
    return;
  }

  if (state.voicePermissionDenied) {
    state.conversationalMode = false;
    updateConversationalButton();
    updateVoiceStatus("Microphone access is blocked. Enable it in the browser and tap to speak manually.");
    return;
  }

  const sequence = state.phase === "bidding" ? getBidOrder() : getActivePlayers().map((player) => player.id);
  const next = sequence.find((playerIndex) => {
    const player = findPlayerById(playerIndex);
    const field = state.phase === "bidding" ? player?.currentBid : player?.currentTricks;
    return field === null || field === "";
  });

  if (typeof next === "number") {
    beginVoiceCapture(next, { spokenPrompt: true });
  } else {
    updateVoiceStatus("Conversational mode waiting. All entries for this phase are filled.");
  }
}

function beginVoiceCapture(playerIndex, options = {}) {
  if (!recognition || state.voicePermissionDenied) return;
  state.pendingTargetIndex = playerIndex;

  if (state.recognitionActive) {
    stopVoiceCapture({ clearPending: false, updateStatus: false });
    return;
  }

  launchRecognition(playerIndex, options);
}

function launchRecognition(playerIndex, options = {}) {
  const player = findPlayerById(playerIndex);
  state.voiceOptions = options;
  state.voiceOutcome = "pending";
  state.voiceTarget = playerIndex;
  renderEntryTable();
  updateVoiceStatus(`Preparing voice capture for ${player.name}...`);

  const startListening = () => {
    try {
      recognition.abort();
    } catch (error) {
      // Ignore abort issues before a fresh start.
    }

    setTimeout(() => {
      try {
        recognition.start();
        state.recognitionActive = true;
        updateVoiceStatus(`Listening for ${player.name}...`);
      } catch (error) {
        state.voiceOutcome = "start-failed";
        if (error.name === "InvalidStateError") {
          updateVoiceStatus("Voice engine was busy. Wait a moment and try again.");
        } else {
          updateVoiceStatus(`Voice start failed: ${error.message}`);
        }
      }
    }, 160);
  };

  if (options.spokenPrompt) {
    speakPromptForPlayer(playerIndex, startListening);
  } else {
    startListening();
  }
}

function stopVoiceCapture({ clearPending = false, updateStatus = true } = {}) {
  if (clearPending) {
    state.pendingTargetIndex = null;
  }
  try {
    recognition?.abort();
  } catch (error) {
    // Ignore stop errors.
  }
  state.recognitionActive = false;
  state.voiceOutcome = "stopped";
  if (updateStatus) {
    updateVoiceStatus("Voice status: idle");
  }
}

function createRecognition() {
  const instance = new SpeechRecognitionCtor();
  instance.lang = "en-IN";
  instance.continuous = false;
  instance.interimResults = false;
  instance.maxAlternatives = 1;

  instance.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || "")
      .join(" ")
      .trim();
    const parsedNumber = parseSpokenNumber(transcript);
    const targetIndex = state.voiceTarget;

    if (typeof targetIndex !== "number") return;

    if (parsedNumber === null) {
      state.voiceOutcome = "unparsed";
      updateVoiceStatus(`Heard "${transcript}", but could not parse a number.`);
      return;
    }

    const round = getCurrentRound();
    if (!round || parsedNumber < 0 || parsedNumber > round.cards) {
      state.voiceOutcome = "out-of-range";
      updateVoiceStatus(`Parsed ${parsedNumber}, but it must be between 0 and ${round.cards}.`);
      return;
    }

    if (state.phase === "bidding") {
      findPlayerById(targetIndex).currentBid = parsedNumber;
    } else {
      findPlayerById(targetIndex).currentTricks = parsedNumber;
    }

    state.voiceOutcome = "success";
    updateVoiceStatus(`${findPlayerById(targetIndex).name}: recorded ${parsedNumber}.`);
    renderGame();
  };

  instance.onerror = (event) => {
    state.voiceOutcome = event.error || "error";
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      state.voicePermissionDenied = true;
      state.conversationalMode = false;
      updateConversationalButton();
    }
    const detail = event.error === "not-allowed"
      ? "Microphone access was denied."
      : event.error === "service-not-allowed"
        ? "Speech recognition is blocked by the browser."
      : event.error === "no-speech"
        ? "No speech detected. Tap to retry when ready."
        : `Recognition error: ${event.error}.`;
    updateVoiceStatus(detail);
  };

  instance.onend = () => {
    state.recognitionActive = false;
    const finishedTarget = state.voiceTarget;
    const queuedTarget = state.pendingTargetIndex;
    state.voiceTarget = null;
    renderEntryTable();

    if (typeof queuedTarget === "number" && queuedTarget !== finishedTarget) {
      const nextTarget = queuedTarget;
      state.pendingTargetIndex = null;
      launchRecognition(nextTarget, state.voiceOptions?.spokenPrompt ? { spokenPrompt: true } : {});
      return;
    }

    state.pendingTargetIndex = null;

    if (state.conversationalMode && state.voiceOutcome === "success") {
      setTimeout(() => {
        startConversationalSequence();
      }, 300);
    }
  };

  return instance;
}

function parseSpokenNumber(text) {
  if (!text) return null;
  const digitMatch = text.match(/\d+/);
  if (digitMatch) return Number(digitMatch[0]);

  const normalized = text.toLowerCase().replace(/[^a-z\s-]/g, " ");
  const parts = normalized.split(/\s+/).filter(Boolean);
  for (const part of parts) {
    if (Object.prototype.hasOwnProperty.call(spokenNumberMap, part)) {
      return spokenNumberMap[part];
    }
  }
  return null;
}

function speakPromptForPlayer(playerIndex, onComplete) {
  if (!synth) {
    onComplete?.();
    return;
  }
  synth.cancel();
  const round = getCurrentRound();
  const player = findPlayerById(playerIndex);
  const field = state.phase === "bidding" ? "bid" : "tricks won";
  const utterance = new SpeechSynthesisUtterance(
    `${player.name}, say your ${field} for ${round.cards} cards.`
  );
  utterance.lang = "en-IN";
  utterance.onend = () => {
    onComplete?.();
  };
  utterance.onerror = () => {
    onComplete?.();
  };
  synth.speak(utterance);
}

function updateVoiceStatus(message) {
  elements.voiceStatus.textContent = message;
}

function finishGame(reason) {
  stopVoiceCapture({ clearPending: true, updateStatus: false });
  state.finalReason = reason;
  elements.gameView.classList.add("hidden");
  elements.setupView.classList.add("hidden");
  elements.finalView.classList.remove("hidden");

  const ranked = [...state.players].sort((a, b) => b.totalScore - a.totalScore || a.name.localeCompare(b.name));
  const winner = ranked[0];
  elements.finalSummary.textContent = `${winner.name} leads the table with ${winner.totalScore} points. ${reason}`;
  elements.finalStandings.innerHTML = "";

  ranked.forEach((player, index) => {
    const item = document.createElement("div");
    item.className = "winner-card";
    item.innerHTML = `
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-xs uppercase tracking-[0.24em] text-stone-400">${index + 1}${ordinalSuffix(index + 1)} place</div>
          <div class="mt-1 text-xl font-semibold text-white">${escapeHtml(player.name)}</div>
          ${player.leftAfterRound ? `<div class="mt-1 text-sm text-stone-400">Left after round ${player.leftAfterRound}</div>` : ""}
        </div>
        <div class="text-right">
          <div class="font-display text-3xl font-bold text-amber-200">${player.totalScore}</div>
          <div class="text-sm text-stone-400">points</div>
        </div>
      </div>
    `;
    elements.finalStandings.appendChild(item);
  });
}

function resetToSetup() {
  stopVoiceCapture({ clearPending: true, updateStatus: false });
  elements.finalView.classList.add("hidden");
  elements.gameView.classList.add("hidden");
  elements.setupView.classList.remove("hidden");
  state.players = [];
  state.rounds = [];
  state.currentRoundIndex = 0;
  state.phase = "setup";
  syncMaxCardsControl(Number(elements.playerCount.value));
  state.nextDealerPlayerId = null;
  state.managingPlayers = false;
  state.roundHistory = [];
  state.lastCompletedRound = null;
  state.finalReason = "";
  state.voicePermissionDenied = false;
  state.voiceOptions = {};
  state.voiceOutcome = "idle";
}

function renderBetweenRounds() {
  const round = state.lastCompletedRound;
  if (!round) return;
  const dealer = getRoundDealer(round);
  elements.roundLabel.textContent = `${round.roundNumber} / ${state.rounds.length}`;
  elements.cardsLabel.textContent = String(round.cards);
  elements.trumpLabel.textContent = `${round.trump.label} ${round.trump.glyph}`;
  elements.dealerLabel.textContent = dealer?.name || "-";
  elements.phaseTitle.textContent = "Round complete";
  elements.phaseSubtitle.textContent = "Continue with the same table, or remove players before the next round begins.";
  elements.hookWarning.classList.add("hidden");
  elements.entryTable.innerHTML = "";
  elements.continueBtn.classList.add("hidden");
  elements.resetRoundBtn.classList.add("hidden");
  elements.betweenRoundsPanel.classList.remove("hidden");
  elements.betweenRoundsMessage.textContent = `Round ${round.roundNumber} has been scored. Active players remaining: ${getActivePlayers().length}.`;
  renderRemovePlayersPanel();
}

function renderRemovePlayersPanel() {
  elements.removePlayersList.innerHTML = "";
  const activePlayers = getActivePlayers();
  activePlayers.forEach((player) => {
    const label = document.createElement("label");
    label.className = "flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-3 text-sm text-stone-200";
    label.innerHTML = `
      <input type="checkbox" class="h-4 w-4 accent-rose-400" value="${player.id}" />
      <span>${escapeHtml(player.name)}</span>
    `;
    elements.removePlayersList.appendChild(label);
  });

  elements.removePlayersPanel.classList.toggle("hidden", !state.managingPlayers);
  elements.confirmRemovePlayersBtn.classList.toggle("hidden", !state.managingPlayers);
  elements.cancelRemovePlayersBtn.classList.toggle("hidden", !state.managingPlayers);
  elements.managePlayersBtn.classList.toggle("hidden", state.managingPlayers);
}

function openRemovePlayersPanel() {
  state.managingPlayers = true;
  renderRemovePlayersPanel();
}

function closeRemovePlayersPanel() {
  state.managingPlayers = false;
  renderRemovePlayersPanel();
}

function confirmPlayerRemoval() {
  const leavingIds = Array.from(elements.removePlayersList.querySelectorAll('input[type="checkbox"]:checked')).map((input) => Number(input.value));
  if (!leavingIds.length) {
    window.alert("Select at least one player to remove.");
    return;
  }

  const roundNumber = state.lastCompletedRound?.roundNumber ?? state.currentRoundIndex;
  state.players.forEach((player) => {
    if (leavingIds.includes(player.id)) {
      player.active = false;
      player.leftAfterRound = roundNumber;
      player.currentBid = null;
      player.currentTricks = null;
    }
  });

  state.managingPlayers = false;

  if (getActivePlayers().length < 4) {
    const shouldEnd = window.confirm("Fewer than 4 active players remain. End the game early?");
    if (shouldEnd) {
      finishGame("Ended early because fewer than 4 active players remained.");
      return;
    }
    renderBetweenRounds();
    return;
  }

  advanceToNextRound();
}

function advanceToNextRound() {
  if (state.currentRoundIndex >= state.rounds.length - 1) {
    finishGame("Completed the full Judgement ladder.");
    return;
  }

  const completedDealer = getRoundDealer(state.lastCompletedRound);
  state.nextDealerPlayerId = getNextActivePlayerId(completedDealer?.id);
  state.currentRoundIndex += 1;
  const nextRound = getCurrentRound();
  if (nextRound) {
    nextRound.dealerPlayerId = state.nextDealerPlayerId;
  }
  state.phase = "bidding";
  state.managingPlayers = false;
  elements.betweenRoundsPanel.classList.add("hidden");
  elements.continueBtn.classList.remove("hidden");
  elements.resetRoundBtn.classList.remove("hidden");
  renderGame();
  if (state.conversationalMode) {
    startConversationalSequence();
  }
}

function findPlayerById(playerId) {
  return state.players.find((player) => player.id === playerId) || null;
}

function syncMaxCardsControl(playerCount) {
  const allowedMax = Math.floor(52 / playerCount);
  const currentValue = Number(elements.maxCards.value || allowedMax);
  const nextValue = Math.min(Math.max(1, currentValue), allowedMax);
  elements.maxCards.max = String(allowedMax);
  elements.maxCards.value = String(nextValue);
  elements.maxCardsValue.textContent = String(nextValue);
  elements.maxCardsHint.textContent = `Default max for ${playerCount} players is ${allowedMax} cards.`;
  state.selectedStartCards = nextValue;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ordinalSuffix(number) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return "st";
  if (mod10 === 2 && mod100 !== 12) return "nd";
  if (mod10 === 3 && mod100 !== 13) return "rd";
  return "th";
}
