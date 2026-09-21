// app.js

// ============================================
// 🔧 آدرس Cloudflare Worker
// ============================================
const TTS_PROXY_URL = "https://dictionary.m-amandar-dev.workers.dev";
// ============================================

// --- State ---
let words = JSON.parse(localStorage.getItem("dic_words") || "[]");
let settings = JSON.parse(localStorage.getItem("dic_settings") || '{"voiceType": "google", "voiceSpeed": "0.8"}');
let expandedWordIndex = null;
let currentSentenceParentIndex = null;

// --- DOM Elements ---
const wordInput = document.getElementById("wordInput");
const meaningInput = document.getElementById("meaningInput");
const addBtn = document.getElementById("addBtn");
const listContainer = document.getElementById("listContainer");
const emptyState = document.getElementById("emptyState");
const wordCount = document.getElementById("wordCount");
const starredCount = document.getElementById("starredCount");
const starredList = document.getElementById("starredList");
const starredModal = document.getElementById("starredModal");
const sentenceModal = document.getElementById("sentenceModal");
const showStarredBtn = document.getElementById("showStarredBtn");
const closeStarredModal = document.getElementById("closeStarredModal");
const closeSentenceModal = document.getElementById("closeSentenceModal");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const clearAllBtn = document.getElementById("clearAllBtn");
const voiceType = document.getElementById("voiceType");
const voiceSpeed = document.getElementById("voiceSpeed");
const testVoiceBtn = document.getElementById("testVoice");

// Modal sentence elements
const modalTitle = document.getElementById("modalTitle");
const modalWordDisplay = document.getElementById("modalWordDisplay");
const modalMeaningDisplay = document.getElementById("modalMeaningDisplay");
const sentenceInput = document.getElementById("sentenceInput");
const sentenceMeaningInput = document.getElementById("sentenceMeaningInput");
const saveSentence = document.getElementById("saveSentence");
const cancelSentence = document.getElementById("cancelSentence");

// --- Initial Setup ---
voiceType.value = settings.voiceType;
voiceSpeed.value = settings.voiceSpeed;
updateCounters();

// --- Local Storage ---
function save() {
  localStorage.setItem("dic_words", JSON.stringify(words));
  localStorage.setItem("dic_settings", JSON.stringify(settings));
}

// --- Text-to-Speech (روتر اصلی) ---
function speakWord(text, lang = 'en') {
  const type = voiceType.value;
  const speed = parseFloat(voiceSpeed.value);

  // اگه زبان فارسی بود، StreamElements پشتیبانی نمی‌کنه → مستقیم سیستم
  if (lang === 'fa') {
    speakWithSystem(text, lang, speed);
    return;
  }

  if (type === 'system') {
    speakWithSystem(text, lang, speed);
  } else {
    speakWithGoogle(text, lang, speed);
  }
}

// --- Web Speech API (آفلاین) ---
function speakWithSystem(text, lang, speed) {
  if (!('speechSynthesis' in window)) {
    alert('مرورگر شما از صدای سیستم پشتیبانی نمی‌کند');
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // انتخاب بهترین صدای موجود
  const voices = window.speechSynthesis.getVoices();
  const targetLangPrefix = lang === 'en' ? 'en' : 'fa';
  const preferred = voices.find(v =>
    v.lang.startsWith(targetLangPrefix) &&
    (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
  ) || voices.find(v => v.lang.startsWith(targetLangPrefix));

  if (preferred) {
    utterance.voice = preferred;
  }

  utterance.lang = lang === 'en' ? 'en-US' : 'fa-IR';
  utterance.rate = speed;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

// --- Google TTS از طریق Cloudflare Worker ---
function speakWithGoogle(text, lang, speed) {
  const googleLang = lang === 'en' ? 'en' : 'fa';
  const url = `${TTS_PROXY_URL}/?text=${encodeURIComponent(text)}&lang=${googleLang}`;

  const audio = new Audio();
  audio.crossOrigin = 'anonymous';
  audio.preload = 'auto';
  audio.src = url;

  let hasPlayed = false;
  let hasFailed = false;

  const tryPlay = () => {
    if (hasPlayed || hasFailed) return;
    hasPlayed = true;
    audio.playbackRate = speed;
    audio.play().catch(err => {
      if (hasFailed) return;
      hasFailed = true;
      console.warn('❌ Google TTS play خطا، fallback به سیستم:', err);
      speakWithSystem(text, lang, speed);
    });
  };

  audio.addEventListener('canplaythrough', tryPlay, { once: true });

  const timeoutId = setTimeout(() => {
    if (hasPlayed || hasFailed) return;
    hasFailed = true;
    console.warn('⏱️ Google TTS timeout، fallback به سیستم');
    speakWithSystem(text, lang, speed);
  }, 4000);

  audio.addEventListener('playing', () => {
    clearTimeout(timeoutId);
  }, { once: true });

  audio.addEventListener('error', (e) => {
    if (hasPlayed || hasFailed) return;
    hasFailed = true;
    clearTimeout(timeoutId);
    console.warn('❌ Google TTS error event:', e);
    speakWithSystem(text, lang, speed);
  }, { once: true });

  audio.load();
}

// --- Voice Settings ---
testVoiceBtn.onclick = () => speakWord('Hello world', 'en');
voiceType.onchange = () => { settings.voiceType = voiceType.value; save(); };
voiceSpeed.onchange = () => { settings.voiceSpeed = voiceSpeed.value; save(); };

// بارگذاری اولیه صداهای سیستم
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {};
}

// --- Update Counters ---
function updateCounters() {
  const total = words.length;
  const starred = words.filter(w => w.starred).length;

  wordCount.textContent = `${total} کلمه`;
  starredCount.textContent = starred;

  if (total === 0) {
    emptyState.classList.add('visible');
    listContainer.style.display = 'none';
  } else {
    emptyState.classList.remove('visible');
    listContainer.style.display = 'flex';
  }
}

// --- Toggle Functions (بدون رندر کامل) ---
function toggleStar(index) {
  words[index].starred = !words[index].starred;
  save();
  updateCounters();
  updateWordCard(index);
}

function toggleMeaning(index) {
  words[index].showMeaning = !words[index].showMeaning;
  save();
  updateWordCard(index);
}

function toggleSentenceMeaning(wordIndex, sentenceIndex) {
  words[wordIndex].sentences[sentenceIndex].showMeaning = !words[wordIndex].sentences[sentenceIndex].showMeaning;
  save();
  updateWordCard(wordIndex);
}

function toggleSentencesContainer(index) {
  if (expandedWordIndex === index) {
    expandedWordIndex = null;
  } else {
    expandedWordIndex = index;
  }
  updateWordCard(index);
}

function deleteWord(index) {
  if (confirm(`آیا از حذف "${words[index].word}" اطمینان دارید؟`)) {
    words.splice(index, 1);
    if (expandedWordIndex === index) {
      expandedWordIndex = null;
    }
    if (expandedWordIndex > index) {
      expandedWordIndex--;
    }
    save();
    renderAllWords();
    updateCounters();
  }
}

function deleteSentence(wordIndex, sentenceIndex) {
  if (confirm('آیا از حذف این جمله اطمینان دارید؟')) {
    words[wordIndex].sentences.splice(sentenceIndex, 1);
    save();
    updateWordCard(wordIndex);
  }
}

// --- Create Word Card ---
function createWordCard(item, index) {
  const card = document.createElement("div");
  card.className = "word-card" + (item.starred ? " starred" : "");
  card.setAttribute('data-index', index);

  // --- بخش اصلی کلمه ---
  const wordMain = document.createElement("div");
  wordMain.className = "word-main";

  // ستاره
  const starBtn = document.createElement("button");
  starBtn.className = "btn-icon star-btn";
  starBtn.textContent = item.starred ? "⭐" : "☆";
  starBtn.title = item.starred ? "حذف از نشان‌دارها" : "افزودن به نشان‌دارها";
  starBtn.onclick = (e) => {
    e.stopPropagation();
    toggleStar(index);
  };

  // تلفظ کلمه
  const speakBtn = document.createElement("button");
  speakBtn.className = "btn-icon speak-btn";
  speakBtn.textContent = "🔊";
  speakBtn.title = "تلفظ کلمه";
  speakBtn.onclick = (e) => {
    e.stopPropagation();
    speakWord(item.word, 'en');
  };

  // متن کلمه
  const wordText = document.createElement("span");
  wordText.className = "word-text";
  wordText.textContent = item.word;

  // متن ترجمه
  const meaningText = document.createElement("span");
  meaningText.className = "meaning-text" + (item.showMeaning ? "" : " hidden");
  meaningText.textContent = item.showMeaning ? item.meaning : "●●●";
  meaningText.title = item.showMeaning ? "کلیک برای پنهان کردن" : "کلیک برای نمایش";
  meaningText.onclick = (e) => {
    e.stopPropagation();
    toggleMeaning(index);
  };

  // نشانگر جمله
  const hasSentences = item.sentences && item.sentences.length > 0;
  const sentenceBadge = document.createElement("span");
  sentenceBadge.className = "sentence-badge" + (hasSentences ? " has-sentence" : "");
  sentenceBadge.textContent = hasSentences ? `📖 ${item.sentences.length} جمله` : "بدون جمله";
  sentenceBadge.title = "نمایش/مخفی کردن جمله‌ها";
  sentenceBadge.onclick = (e) => {
    e.stopPropagation();
    toggleSentencesContainer(index);
  };

  // دکمه باز/بسته کردن جمله‌ها
  const expandBtn = document.createElement("button");
  expandBtn.className = "btn-icon expand-btn" + (expandedWordIndex === index ? " expanded" : "");
  expandBtn.textContent = "▼";
  expandBtn.title = "نمایش/مخفی کردن جمله‌ها";
  expandBtn.onclick = (e) => {
    e.stopPropagation();
    toggleSentencesContainer(index);
  };

  // حذف کلمه
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-icon delete-btn";
  deleteBtn.textContent = "🗑️";
  deleteBtn.title = "حذف کلمه";
  deleteBtn.onclick = (e) => {
    e.stopPropagation();
    deleteWord(index);
  };

  // گروه دکمه‌ها
  const actions = document.createElement("div");
  actions.className = "word-actions";
  actions.appendChild(starBtn);
  actions.appendChild(speakBtn);
  actions.appendChild(expandBtn);
  actions.appendChild(deleteBtn);

  wordMain.appendChild(wordText);
  wordMain.appendChild(meaningText);
  wordMain.appendChild(sentenceBadge);
  wordMain.appendChild(actions);

  card.appendChild(wordMain);

  // --- بخش جمله‌ها (زیرمجموعه) ---
  const sentencesContainer = document.createElement("div");
  sentencesContainer.className = "sentences-container" + (expandedWordIndex === index ? " open" : "");

  // هدر بخش جمله‌ها
  const sentencesHeader = document.createElement("div");
  sentencesHeader.className = "sentences-header";

  const sentencesTitle = document.createElement("span");
  sentencesTitle.className = "sentences-title";
  sentencesTitle.textContent = "📝 جمله‌ها";

  const addSentenceBtn = document.createElement("button");
  addSentenceBtn.className = "btn-add-sentence";
  addSentenceBtn.textContent = "➕ افزودن جمله";
  addSentenceBtn.onclick = (e) => {
    e.stopPropagation();
    openSentenceModal(index);
  };

  sentencesHeader.appendChild(sentencesTitle);
  sentencesHeader.appendChild(addSentenceBtn);
  sentencesContainer.appendChild(sentencesHeader);

  // لیست جمله‌ها
  if (hasSentences) {
    item.sentences.forEach((sentence, sIndex) => {
      sentencesContainer.appendChild(createSentenceItem(item, sentence, index, sIndex));
    });
  } else {
    const noSentences = document.createElement("div");
    noSentences.className = "no-sentences";
    noSentences.textContent = "هنوز جمله‌ای اضافه نشده است";
    sentencesContainer.appendChild(noSentences);
  }

  card.appendChild(sentencesContainer);

  return card;
}

// --- Create Sentence Item ---
function createSentenceItem(wordItem, sentence, wordIndex, sentenceIndex) {
  const sentenceItem = document.createElement("div");
  sentenceItem.className = "sentence-item";

  // متن جمله
  const sentenceText = document.createElement("span");
  sentenceText.className = "sentence-text";
  sentenceText.textContent = sentence.text;

  // ترجمه جمله
  const sentenceMeaning = document.createElement("span");
  sentenceMeaning.className = "sentence-meaning" + (sentence.showMeaning ? "" : " hidden");
  sentenceMeaning.textContent = sentence.showMeaning ? sentence.meaning : "●●●";
  sentenceMeaning.title = sentence.showMeaning ? "کلیک برای پنهان کردن" : "کلیک برای نمایش";
  sentenceMeaning.onclick = (e) => {
    e.stopPropagation();
    toggleSentenceMeaning(wordIndex, sentenceIndex);
  };

  // دکمه‌های عملیات جمله
  const sentenceActions = document.createElement("div");
  sentenceActions.className = "sentence-actions";

  // تلفظ جمله
  const speakSentenceBtn = document.createElement("button");
  speakSentenceBtn.className = "btn-icon-sm speak-btn";
  speakSentenceBtn.textContent = "🔊";
  speakSentenceBtn.title = "تلفظ جمله";
  speakSentenceBtn.onclick = (e) => {
    e.stopPropagation();
    speakWord(sentence.text, 'en');
  };

  // نمایش/پنهان ترجمه جمله
  const toggleSentenceMeaningBtn = document.createElement("button");
  toggleSentenceMeaningBtn.className = "btn-icon-sm toggle-btn";
  toggleSentenceMeaningBtn.textContent = sentence.showMeaning ? "🙈" : "👁️";
  toggleSentenceMeaningBtn.title = sentence.showMeaning ? "پنهان کردن ترجمه" : "نمایش ترجمه";
  toggleSentenceMeaningBtn.onclick = (e) => {
    e.stopPropagation();
    toggleSentenceMeaning(wordIndex, sentenceIndex);
  };

  // حذف جمله
  const deleteSentenceBtn = document.createElement("button");
  deleteSentenceBtn.className = "btn-icon-sm delete-btn";
  deleteSentenceBtn.textContent = "🗑️";
  deleteSentenceBtn.title = "حذف جمله";
  deleteSentenceBtn.onclick = (e) => {
    e.stopPropagation();
    deleteSentence(wordIndex, sentenceIndex);
  };

  sentenceActions.appendChild(speakSentenceBtn);
  sentenceActions.appendChild(toggleSentenceMeaningBtn);
  sentenceActions.appendChild(deleteSentenceBtn);

  sentenceItem.appendChild(sentenceText);
  sentenceItem.appendChild(sentenceMeaning);
  sentenceItem.appendChild(sentenceActions);

  return sentenceItem;
}

// --- Update Single Word Card (بدون رندر کامل) ---
function updateWordCard(index) {
  const oldCard = document.querySelector(`[data-index="${index}"]`);
  if (oldCard) {
    const newCard = createWordCard(words[index], index);
    oldCard.replaceWith(newCard);
  }
  updateCounters();
}

// --- Sentence Modal ---
function openSentenceModal(wordIndex) {
  currentSentenceParentIndex = wordIndex;
  const word = words[wordIndex];

  modalTitle.textContent = `📖 افزودن جمله برای "${word.word}"`;
  modalWordDisplay.textContent = word.word;
  modalMeaningDisplay.textContent = word.meaning;
  sentenceInput.value = '';
  sentenceMeaningInput.value = '';

  sentenceModal.style.display = "flex";
  sentenceInput.focus();
}

function closeSentenceModalFunc() {
  sentenceModal.style.display = "none";
  currentSentenceParentIndex = null;
}

saveSentence.onclick = () => {
  const text = sentenceInput.value.trim();
  const meaning = sentenceMeaningInput.value.trim();

  if (!text || !meaning) {
    alert('لطفاً جمله و ترجمه آن را وارد کنید');
    return;
  }

  if (currentSentenceParentIndex !== null) {
    if (!words[currentSentenceParentIndex].sentences) {
      words[currentSentenceParentIndex].sentences = [];
    }

    words[currentSentenceParentIndex].sentences.push({
      text: text,
      meaning: meaning,
      showMeaning: false
    });

    save();
    updateWordCard(currentSentenceParentIndex);
    closeSentenceModalFunc();
  }
};

cancelSentence.onclick = closeSentenceModalFunc;
closeSentenceModal.onclick = closeSentenceModalFunc;

sentenceModal.addEventListener("click", (e) => {
  if (e.target === sentenceModal) {
    closeSentenceModalFunc();
  }
});

// --- Starred Modal ---
function openStarredModal() {
  const starredWords = words.filter(w => w.starred);
  starredList.innerHTML = '';

  if (starredWords.length === 0) {
    starredList.innerHTML = '<div class="empty-state visible"><div class="empty-icon">⭐</div><h3>کلمه نشان‌داری وجود ندارد</h3><p>برای نشان‌دار کردن کلمات روی ستاره کنار آنها کلیک کنید</p></div>';
  } else {
    starredWords.forEach((item) => {
      const originalIndex = words.indexOf(item);
      starredList.appendChild(createWordCard(item, originalIndex));
    });
  }

  starredModal.style.display = "flex";
}

function closeStarredModalFunc() {
  starredModal.style.display = "none";
  renderAllWords();
}

showStarredBtn.onclick = openStarredModal;
closeStarredModal.onclick = closeStarredModalFunc;

starredModal.addEventListener("click", (e) => {
  if (e.target === starredModal) {
    closeStarredModalFunc();
  }
});

// --- Render All Words ---
function renderAllWords() {
  listContainer.innerHTML = '';

  if (words.length === 0) {
    updateCounters();
    return;
  }

  words.forEach((item, index) => {
    listContainer.appendChild(createWordCard(item, index));
  });

  updateCounters();
}

// --- Add New Word ---
addBtn.onclick = () => {
  const w = wordInput.value.trim();
  const m = meaningInput.value.trim();

  if (!w || !m) {
    alert('لطفاً کلمه و ترجمه را وارد کنید');
    return;
  }

  const newWord = {
    word: w,
    meaning: m,
    sentences: [],
    showMeaning: false,
    starred: false
  };

  words.unshift(newWord);
  save();

  wordInput.value = "";
  meaningInput.value = "";
  wordInput.focus();

  renderAllWords();
};

// --- Keyboard Shortcuts ---
wordInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    meaningInput.focus();
  }
});

meaningInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addBtn.click();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (sentenceModal.style.display === "flex") {
      closeSentenceModalFunc();
    } else if (starredModal.style.display === "flex") {
      closeStarredModalFunc();
    }
  }

  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    exportWords();
  }
});

sentenceMeaningInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && e.ctrlKey) {
    saveSentence.click();
  }
});

// --- Export ---
function exportWords() {
  const data = JSON.stringify(words, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dictionary_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

exportBtn.onclick = exportWords;

// --- Import ---
importBtn.onclick = () => importInput.click();

importInput.onchange = async () => {
  const file = importInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = JSON.parse(text);

    if (Array.isArray(imported)) {
      words = imported.map(item => ({
        word: item.word || "",
        meaning: item.meaning || "",
        sentences: Array.isArray(item.sentences) ? item.sentences.map(s => ({
          text: s.text || "",
          meaning: s.meaning || "",
          showMeaning: s.showMeaning || false
        })) : [],
        showMeaning: item.showMeaning || false,
        starred: item.starred || false
      }));

      save();
      expandedWordIndex = null;
      renderAllWords();
      alert('✅ فایل با موفقیت وارد شد');
    } else {
      alert('❌ فرمت فایل نامعتبر است');
    }
  } catch (err) {
    console.error("خطا در خواندن فایل:", err);
    alert('❌ خطا در خواندن فایل. لطفاً از فرمت JSON معتبر استفاده کنید');
  }

  importInput.value = "";
};

// --- Clear All ---
clearAllBtn.onclick = () => {
  if (words.length === 0) {
    alert('لیست قبلاً خالی است');
    return;
  }

  if (confirm("⚠️ همه لغات حذف شوند؟ این عملیات قابل بازگشت نیست!")) {
    words = [];
    expandedWordIndex = null;
    save();
    renderAllWords();
  }
};

// --- Initial Render ---
renderAllWords();